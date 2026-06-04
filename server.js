const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const fs = require("fs");

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Date calculation constants
const EPOCH_DATE = new Date(2000, 0, 1);
const MINUTES_PER_WORKDAY = 9 * 60;
const MINUTES_PER_THURSDAY = 8.5 * 60;

// Month name mappings (Hebrew and English)
const MONTH_NAMES = {
  // Hebrew months
  ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6,
  יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
  // English months
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

// Weekday names
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", 
  "Thursday", "Friday", "Saturday"
];

// Hilan API endpoints
const HILAN_API = {
  LOGIN: "https://motorola.net.hilan.co.il/HilanCenter/Public/api/LoginApi/LoginRequest",
  ATTENDANCE: "https://motorola.net.hilan.co.il/Hilannetv2/Attendance/calendarpage.aspx?isPersonalFileMode=true&ReportPageMode=2"
};

// How many previous months to fetch in addition to the current month
const PREVIOUS_MONTHS_TO_FETCH = 2;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ============================================================================
// UTILITY FUNCTIONS - DATE & TIME
// ============================================================================

/**
 * Calculates a date by adding offset days to the epoch date
 * @param {number} offsetFromEpoch - Number of days since epoch
 * @returns {Date} The calculated date
 */
function calculateDateFromEpoch(offsetFromEpoch) {
  const date = new Date(EPOCH_DATE);
  date.setDate(EPOCH_DATE.getDate() + offsetFromEpoch);
  return date;
}

/**
 * Formats time in Hebrew
 * @param {number} hours - Number of hours
 * @param {number} minutes - Number of minutes
 * @returns {string} Formatted Hebrew string
 */
function formatTimeInHebrew(hours, minutes) {
  const hourText = `${hours} שעות`;
  const minuteText = minutes > 0 ? ` ${minutes} דקות` : "";
  return hourText + minuteText;
}

/**
 * Sorts time entries by date (year, month, day)
 * @param {Array} timeEntries - Array of time entry objects
 * @returns {Array} Sorted array
 */
function sortTimeEntries(timeEntries) {
  return timeEntries.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split("/").map(Number);
    const [dayB, monthB, yearB] = b.date.split("/").map(Number);

    if (yearA !== yearB) return yearA - yearB;
    if (monthA !== monthB) return monthA - monthB;
    return dayA - dayB;
  });
}

// ============================================================================
// HTML PARSING FUNCTIONS
// ============================================================================

/**
 * Extracts month and year from HTML calendar content
 * @param {string} htmlContent - The HTML content
 * @returns {Object} Object with month and year properties
 */
function extractMonthYear(htmlContent) {
  let month = 0;
  let year = 0;

  // Try to extract from month selector dropdown
  const monthYearMatch = htmlContent.match(
    /id="ctl00_mp_calendar_monthChanged"[^>]*>([^<]+)<\/span>/
  );
  
  if (monthYearMatch) {
    const monthYearText = monthYearMatch[1];
    
    // Extract year
    const yearMatch = monthYearText.match(/\d{4}/);
    if (yearMatch) {
      year = parseInt(yearMatch[0]);
    }
    
    // Extract month by matching month name
    for (const [monthName, monthNum] of Object.entries(MONTH_NAMES)) {
      if (monthYearText.includes(monthName)) {
        month = monthNum;
        break;
      }
    }
  }

  // Fallback: try to extract from hidden input field
  const currentMonthMatch = htmlContent.match(
    /id="ctl00_mp_currentMonth"\s+value="(\d{2})\/(\d{2})\/(\d{4})"/
  );
  
  if (currentMonthMatch) {
    month = parseInt(currentMonthMatch[2]);
    year = parseInt(currentMonthMatch[3]);
  }

  return { month, year };
}

/**
 * Extracts work hours from HTML calendar content
 * @param {string} htmlContent - The HTML content
 * @returns {Array} Array of time entry objects
 */
function extractWorkHours(htmlContent) {
  const timeEntries = [];
  const { month, year } = extractMonthYear(htmlContent);
  
  console.log('🔍 Searching for time entries...');
  
  // Pattern to match calendar day cells
  // Looks for: <td Days="X">...<td class="dTS">Y</td>...<div class="cDM">Z</div>
  const cellPattern = /<td[^>]*Days="(\d+)"[^>]*>[\s\S]*?<td class="dTS">(\d+)<\/td>[\s\S]*?<div class="cDM[^"]*"[^>]*>([^<]+)<\/div>/g;
  let cellMatch;
  const processedDays = new Set();
  
  while ((cellMatch = cellPattern.exec(htmlContent)) !== null) {
    const offsetFromEpoch = parseInt(cellMatch[1]);
    const dayNumber = parseInt(cellMatch[2]);
    const timeText = cellMatch[3].trim();
    
    // Skip if this day was already processed
    if (processedDays.has(offsetFromEpoch)) {
      continue;
    }
    processedDays.add(offsetFromEpoch);
    
    // Calculate the actual date from the offset
    const exactDate = calculateDateFromEpoch(offsetFromEpoch);
    const day = exactDate.getDate();
    const calculatedMonth = exactDate.getMonth() + 1;
    const calculatedYear = exactDate.getFullYear();
    const dayOfWeek = WEEKDAYS[exactDate.getDay()];
    
    // Validate and extract time (format: HH:MM)
    let timeValue = null;
    const timeRegex = /^\d{1,2}:\d{2}$/;
    if (timeRegex.test(timeText)) {
      timeValue = timeText;
    }
    
    // Check if it's a weekend
    const isWeekend = exactDate.getDay() === 5 || exactDate.getDay() === 6;
    
    // Determine holiday name (if text is not a time and not empty)
    const holidayName = (timeText !== '&nbsp;' && !timeValue) ? timeText : null;
    const isHoliday = isWeekend || (timeText !== '&nbsp;' && !timeValue);
    
    console.log(`  📅 Found day ${day}/${calculatedMonth}: time="${timeValue || timeText}", weekday="${dayOfWeek}"`);
    
    timeEntries.push({
      date: `${day}/${calculatedMonth}/${calculatedYear}`,
      day: dayOfWeek,
      time: timeValue || '---',
      offsetFromEpoch: offsetFromEpoch,
      holidayName: holidayName,
      isHoliday: isHoliday
    });
  }
  
  console.log('  Total entries found:', timeEntries.length);
  
  return sortTimeEntries(timeEntries);
}

// ============================================================================
// DATA PROCESSING FUNCTIONS
// ============================================================================

/**
 * Gets all days in the month, including days without time entries
 * @param {Array} timeEntries - Array of time entry objects
 * @returns {Array} Complete array of all days in the month
 */
function getAllDaysInMonth(timeEntries) {
  if (!timeEntries || timeEntries.length === 0) {
    return [];
  }

  const firstEntry = timeEntries[0];
  const [day, month, year] = firstEntry.date.split("/").map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  
  // Create a map of entries by day for quick lookup
  const entriesByDay = {};
  timeEntries.forEach((entry) => {
    const [entryDay] = entry.date.split("/").map(Number);
    entriesByDay[entryDay] = entry;
  });

  // Build array with all days of the month
  const allDays = [];
  for (let dayOfMonth = 1; dayOfMonth <= lastDayOfMonth; dayOfMonth++) {
    const currentDate = new Date(year, month - 1, dayOfMonth);
    const dayOfWeek = WEEKDAYS[currentDate.getDay()];

    if (entriesByDay[dayOfMonth]) {
      allDays.push(entriesByDay[dayOfMonth]);
    } else {
      // Add placeholder for days without entries
      allDays.push({
        date: `${dayOfMonth}/${month}/${year}`,
        day: dayOfWeek,
        time: "---",
        isFutureDay: true,
      });
    }
  }

  return allDays;
}

/**
 * Calculates the monthly work hour requirement
 * @param {Array} timeEntries - Array of time entry objects
 * @returns {Object} Monthly requirement details
 */
function calculateMonthlyRequirement(timeEntries) {
  if (!timeEntries || timeEntries.length === 0) {
    return {
      totalRequiredHours: 0,
      totalRequiredMinutes: 0,
      totalRequiredFormatted: "0 שעות",
      completedHours: 0,
      completedMinutes: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingFormatted: "0 שעות",
    };
  }

  let totalRequiredMinutes = 0;

  // Calculate required minutes for each workday
  timeEntries.forEach((entry) => {
    const isWeekend = entry.day === "Friday" || entry.day === "Saturday";
    const isHoliday = entry.isHoliday;
    
    if (!isWeekend && !isHoliday) {
      if (entry.day === "Thursday") {
        totalRequiredMinutes += MINUTES_PER_THURSDAY;
      } else {
        totalRequiredMinutes += MINUTES_PER_WORKDAY;
      }
    }
  });

  const totalRequiredHours = Math.floor(totalRequiredMinutes / 60);
  const totalRequiredRemainingMinutes = totalRequiredMinutes % 60;

  return {
    totalRequiredHours,
    totalRequiredMinutes,
    totalRequiredFormatted: formatTimeInHebrew(
      totalRequiredHours,
      totalRequiredRemainingMinutes
    ),
    completedHours: 0,
    completedMinutes: 0,
    remainingHours: totalRequiredHours,
    remainingMinutes: totalRequiredRemainingMinutes,
    remainingFormatted: formatTimeInHebrew(
      totalRequiredHours,
      totalRequiredRemainingMinutes
    ),
  };
}

/**
 * Calculates total worked time and remaining hours
 * @param {Array} timeEntries - Array of time entry objects
 * @returns {Object} Calculation results
 */
function calculateTotalTime(timeEntries) {
  let totalMinutes = 0;

  // Sum up all worked hours
  timeEntries.forEach((entry) => {
    const timeRegex = /^\d+:\d+$/;
    if (entry.time && timeRegex.test(entry.time)) {
      const [hours, minutes] = entry.time.split(":").map(Number);
      totalMinutes += hours * 60 + minutes;
    }
  });

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  // Get complete month data and calculate requirements
  const allDaysInMonth = getAllDaysInMonth(timeEntries);
  const monthlyRequirement = calculateMonthlyRequirement(allDaysInMonth);

  // Calculate remaining required work
  const totalCompletedMinutes = totalMinutes;
  const totalRequiredMinutes = monthlyRequirement.totalRequiredMinutes;
  const remainingRequiredMinutes = Math.max(0, totalRequiredMinutes - totalCompletedMinutes);

  // Update monthly requirement with completion data
  monthlyRequirement.completedHours = totalHours;
  monthlyRequirement.completedMinutes = remainingMinutes;
  monthlyRequirement.remainingHours = Math.floor(remainingRequiredMinutes / 60);
  monthlyRequirement.remainingMinutes = remainingRequiredMinutes % 60;
  monthlyRequirement.remainingFormatted = formatTimeInHebrew(
    monthlyRequirement.remainingHours,
    monthlyRequirement.remainingMinutes
  );

  return {
    entries: allDaysInMonth,
    totalHours,
    totalMinutes,
    remainingMinutes,
    formatted: formatTimeInHebrew(totalHours, remainingMinutes),
    duration: `${totalHours}:${remainingMinutes < 10 ? "0" + remainingMinutes : remainingMinutes}`,
    monthlyRequirement,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Performs login to Hilan system
 * @param {Object} credentials - Login credentials
 * @returns {Promise<Object>} Login response data
 */
async function performLogin(credentials) {
  const { orgId, username, password } = credentials;
  
  console.log("\n=== STEP 2: Attempting login ===");
  
  const loginResponse = await fetch(HILAN_API.LOGIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      orgId,
      username,
      password,
      isEn: false,
    }),
    redirect: "follow",
  });

  console.log("Login response status:", loginResponse.status);

  if (!loginResponse.ok) {
    console.log("❌ Login failed with status:", loginResponse.status);
    throw new Error(`ההתחברות נכשלה עם סטטוס: ${loginResponse.status}`);
  }

  const loginData = await loginResponse.json();
  console.log("✅ Login response received");
  console.log("Login data:", JSON.stringify(loginData).substring(0, 200) + "...");

  if (loginData.IsFail) {
    console.log("❌ Login error:", loginData.ErrorMessage);
    throw new Error(`שגיאת התחברות: ${loginData.ErrorMessage || "שגיאה לא ידועה"}`);
  }
  
  console.log("✅ Login successful");
  
  return loginResponse;
}

/**
 * Extracts and formats cookies from response
 * @param {Response} response - Fetch response object
 * @returns {string} Formatted cookie string
 */
function extractCookies(response) {
  console.log("\n=== STEP 3: Extracting cookies ===");
  
  const cookies = response.headers.raw()["set-cookie"];

  if (!cookies || cookies.length === 0) {
    console.log("❌ No cookies received");
    throw new Error("לא התקבלו עוגיות מההתחברות");
  }

  console.log("✅ Cookies received:", cookies.length, "cookie(s)");
  console.log("First cookie preview:", cookies[0].substring(0, 100) + "...");

  const cookieString = cookies
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

  console.log("Cookie string length:", cookieString.length);
  
  return cookieString;
}

/**
 * Fetches attendance page HTML
 * @param {string} cookieString - Authentication cookies
 * @returns {Promise<string>} HTML content
 */
async function fetchAttendancePage(cookieString) {
  console.log("\n=== STEP 4: Fetching attendance page ===");
  
  const attendanceResponse = await fetch(HILAN_API.ATTENDANCE, {
    method: "GET",
    headers: {
      Cookie: cookieString,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: "https://motorola.net.hilan.co.il/",
    },
    redirect: "follow",
  });

  console.log("Attendance page status:", attendanceResponse.status);

  if (!attendanceResponse.ok) {
    console.log("❌ Failed to fetch attendance page");
    throw new Error(`נכשל להביא נתוני נוכחות: ${attendanceResponse.status}`);
  }

  const htmlContent = await attendanceResponse.text();
  console.log("✅ HTML content received, length:", htmlContent.length);

  // Save HTML to file for debugging
  fs.writeFileSync("debug_calendar.html", htmlContent, "utf8");
  console.log("📁 HTML saved to debug_calendar.html");
  
  return htmlContent;
}

/**
 * Extracts a hidden form field value from either a normal HTML page
 * (GET response) or an ASP.NET async-postback delta (POST response).
 * @param {string} content - HTML or async delta content
 * @param {string} fieldName - The form field name (e.g. "__VIEWSTATE")
 * @returns {string|null} The field value, or null if not found
 */
function extractHiddenField(content, fieldName) {
  // Async postback delta format: |<len>|hiddenField|<name>|<value>|
  const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\$]/g, "\\$&");
  const deltaMatch = content.match(
    new RegExp(`\\|hiddenField\\|${escapedName}\\|([^|]*)\\|`)
  );
  if (deltaMatch) {
    return deltaMatch[1];
  }

  // Standard HTML input (attribute order may vary)
  const inputMatch = content.match(
    new RegExp(`name="${escapedName}"[^>]*\\svalue="([^"]*)"`)
  ) || content.match(
    new RegExp(`value="([^"]*)"[^>]*\\sname="${escapedName}"`)
  );
  return inputMatch ? inputMatch[1] : null;
}

/**
 * Extracts the employee/user id used in the attendance grid control ids.
 * @param {string} content - HTML content
 * @returns {string|null} The user id, or null if not found
 */
function extractUserId(content) {
  const scriptMatch = content.match(/var userId\s*=\s*'(\d+)'/);
  if (scriptMatch) {
    return scriptMatch[1];
  }
  const hiddenMatch = content.match(/name="ctl00\$mp\$Strip\$hCurrentItemId"[^>]*value="(\d+)"/);
  return hiddenMatch ? hiddenMatch[1] : null;
}

/**
 * Reads the currently displayed month from the calendar page state.
 * @param {string} content - HTML or async delta content
 * @returns {Object|null} { day, month, year, value: "dd/mm/yyyy" } or null
 */
function extractCurrentMonthValue(content) {
  const match = content.match(
    /name="ctl00\$mp\$currentMonth"[^>]*value="(\d{2})\/(\d{2})\/(\d{4})"/
  );
  if (!match) {
    return null;
  }
  return {
    day: parseInt(match[1]),
    month: parseInt(match[2]),
    year: parseInt(match[3]),
    value: `${match[1]}/${match[2]}/${match[3]}`,
  };
}

/**
 * Computes a month string (dd/mm/yyyy, day = 01) offset by a number of months.
 * @param {number} month - Source month (1-12)
 * @param {number} year - Source year
 * @param {number} monthsBack - Months to subtract
 * @returns {string} Target month as "01/MM/YYYY"
 */
function computeMonthString(month, year, monthsBack) {
  // month is 1-based; build a Date and shift by months
  const target = new Date(year, month - 1 - monthsBack, 1);
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const yyyy = target.getFullYear();
  return `01/${mm}/${yyyy}`;
}

/**
 * Navigates the calendar page to a specific month via an ASP.NET async
 * postback and returns the response content.
 * @param {string} cookieString - Authentication cookies
 * @param {string} previousContent - Content of the currently displayed page
 * @param {string} targetMonth - Target month as "01/MM/YYYY"
 * @returns {Promise<string>} The async postback response content
 */
async function navigateToMonth(cookieString, previousContent, targetMonth) {
  const viewState = extractHiddenField(previousContent, "__VIEWSTATE");
  const viewStateGenerator =
    extractHiddenField(previousContent, "__VIEWSTATEGENERATOR") || "";
  const currentMonth = extractCurrentMonthValue(previousContent);
  const userId = extractUserId(previousContent);

  if (!viewState || !currentMonth) {
    throw new Error(
      "לא ניתן לנווט לחודש קודם: חסרים נתוני מצב מהדף (__VIEWSTATE/currentMonth)"
    );
  }

  // Grid control ids are namespaced by user id and the displayed year/month
  const gridPrefix = userId
    ? `ctl00$mp$RG_Days_${userId}_${currentMonth.year}_${String(currentMonth.month).padStart(2, "0")}`
    : null;

  const form = new URLSearchParams();
  form.append("ctl00$ms", "ctl00$mp$calendarUpdator|ctl00_mp_calendar_monthChanged");
  form.append("__EVENTTARGET", "ctl00_mp_calendar_monthChanged");
  form.append("__EVENTARGUMENT", targetMonth);
  form.append("Time", "9");
  form.append("DisableTimeout", "true");
  form.append("__LASTFOCUS", "");
  form.append("ctl00_datePickerTmp_State", "");
  form.append("__VIEWSTATE", viewState);
  form.append("H-XSRF-Token", "");
  form.append("__VIEWSTATEGENERATOR", viewStateGenerator);
  form.append("ctl00$mp$Strip$blSaveList", "-1");
  form.append("ctl00$mp$Strip$ACESearch_Value", "");
  form.append("ctl00$mp$Strip$hSelectedIds", "");
  if (userId) {
    form.append("ctl00$mp$Strip$hCurrentItemId", userId);
  }
  form.append("ctl00$mp$currentMonth", currentMonth.value);
  if (gridPrefix) {
    form.append(`${gridPrefix}$errorMode`, "");
    form.append(`${gridPrefix}$cellOf_Symbol.SymbolId_EmployeeReports_row_0_0$Symbol.SymbolId_EmployeeReports_row_0_0`, "0");
  }
  form.append("ctl00$mp$scriptBox", "");
  form.append("ctl00$datePickerTmp$jdatePicker", "");
  form.append("ctl00$DummyAutoComplete_Value", "");
  form.append("hiddenInputToUpdateATBuffer_CommonToolkitScripts", "1");
  form.append("__ASYNCPOST", "true");
  form.append("__NextBtnState", "false");
  form.append("__PrevBtnState", "false");
  form.append("ReportPageMode", "7");

  const response = await fetch(HILAN_API.ATTENDANCE, {
    method: "POST",
    headers: {
      Cookie: cookieString,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "*/*",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      "X-MicrosoftAjax": "Delta=true",
      "X-Requested-With": "XMLHttpRequest",
      Referer: HILAN_API.ATTENDANCE,
      Origin: "https://motorola.net.hilan.co.il",
    },
    body: form.toString(),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`נכשל לנווט לחודש ${targetMonth}: ${response.status}`);
  }

  return response.text();
}

/**
 * Fetches the current month plus a number of previous months.
 * @param {string} cookieString - Authentication cookies
 * @param {string} currentMonthHtml - HTML of the current month (initial GET)
 * @param {number} previousMonthsCount - How many previous months to fetch
 * @returns {Promise<Array>} Array of { month, year, entries } newest-first
 */
async function fetchMonths(cookieString, currentMonthHtml, previousMonthsCount) {
  const months = [];

  // Current month (already fetched)
  const current = extractMonthYear(currentMonthHtml);
  months.push({
    month: current.month,
    year: current.year,
    entries: extractWorkHours(currentMonthHtml),
  });

  // Walk back one month at a time, chaining the page state
  let previousContent = currentMonthHtml;
  for (let i = 1; i <= previousMonthsCount; i++) {
    const source = extractCurrentMonthValue(previousContent) || {
      month: current.month,
      year: current.year,
    };
    const targetMonth = computeMonthString(source.month, source.year, 1);

    console.log(`\n=== Fetching previous month (${targetMonth}) ===`);
    try {
      const monthContent = await navigateToMonth(
        cookieString,
        previousContent,
        targetMonth
      );
      const { month, year } = extractMonthYear(monthContent);
      const entries = extractWorkHours(monthContent);
      console.log(`✅ Month ${month}/${year}: ${entries.length} entries`);

      months.push({ month, year, entries });
      previousContent = monthContent;
    } catch (error) {
      console.log(`⚠️  Failed to fetch ${targetMonth}: ${error.message}`);
      break;
    }
  }

  return months;
}

/**
 * Validates that time entries were found
 * @param {Array} timeEntries - Array of time entries
 * @param {number} month - Current month
 * @param {number} year - Current year
 * @throws {Error} If no entries found or calendar shows wrong month
 */
function validateTimeEntries(timeEntries, month, year) {
  if (timeEntries.length > 0) {
    return; // Validation passed
  }
  
  console.log("❌ No time entries found");

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  let errorMessage = "לא נמצאו רשומות זמן בתגובה";

  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    errorMessage = `הלוח שנה מציג חודש עתידי (${month}/${year}). אין נתונים זמינים עדיין.`;
    console.log("⚠️  Calendar showing future month");
  } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
    errorMessage = `הלוח שנה מציג חודש עבר (${month}/${year}).`;
    console.log("⚠️  Calendar showing past month");
  }

  const error = new Error(errorMessage);
  error.statusCode = 404;
  error.debug = {
    displayedMonth: month,
    displayedYear: year,
    currentMonth,
    currentYear,
  };
  
  throw error;
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Main API endpoint for fetching Hilan data
 */
app.post("/api/hilan-data", async (req, res) => {
  try {
    const { orgId, username, password } = req.body;

    // Step 1: Validate input
    console.log("=== STEP 1: Validating input ===");
    if (!orgId || !username || !password) {
      console.log("❌ Missing credentials");
      return res.status(400).json({
        success: false,
        error: "נדרשים מזהה ארגון, מספר עובד וסיסמה",
      });
    }
    console.log("✅ Input validated:", { orgId, username });

    // Step 2: Login
    const loginResponse = await performLogin({ orgId, username, password });

    // Step 3: Extract cookies
    const cookieString = extractCookies(loginResponse);

    // Step 4: Fetch attendance page (current month)
    const htmlContent = await fetchAttendancePage(cookieString);

    // Step 5: Extract month/year for the current month
    console.log("\n=== STEP 5: Extracting month/year ===");
    const { month, year } = extractMonthYear(htmlContent);
    console.log("Calendar displaying:", { month, year });

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    console.log("Current date:", { currentMonth, currentYear });

    // Step 6: Fetch current month plus previous months
    console.log("\n=== STEP 6: Fetching months (current + previous) ===");
    const rawMonths = await fetchMonths(
      cookieString,
      htmlContent,
      PREVIOUS_MONTHS_TO_FETCH
    );

    // Validate that the current month returned entries
    validateTimeEntries(rawMonths[0].entries, month, year);

    // Step 7: Calculate totals per month
    console.log("\n=== STEP 7: Calculating total time per month ===");
    const months = rawMonths.map((m) => {
      const result = calculateTotalTime(m.entries);
      console.log(
        `  ${m.month}/${m.year}: ${result.formatted} (${result.entries.length} days)`
      );
      return {
        month: m.month,
        year: m.year,
        data: result,
      };
    });
    console.log("✅ Calculation complete for", months.length, "month(s)");

    console.log("\n=== SUCCESS: Returning data to client ===");
    // `data` keeps backward compatibility (current month); `months` carries all
    return res.json({
      success: true,
      data: months[0].data,
      months,
    });
    
  } catch (error) {
    console.error("\n=== ERROR OCCURRED ===");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);

    const statusCode = error.statusCode || 500;
    const errorResponse = {
      success: false,
      error: error.message || "אירעה שגיאה לא ידועה",
    };
    
    if (error.debug) {
      errorResponse.debug = error.debug;
    }

    return res.status(statusCode).json(errorResponse);
  }
});

/**
 * Catch-all route for serving the main HTML page
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Open this address in your browser");
});

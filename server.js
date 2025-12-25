const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const EPOCH_DATE = new Date(2000, 0, 1);
const MINUTES_PER_WORKDAY = 9 * 60;
const MINUTES_PER_THURSDAY = 8.5 * 60;
const MONTH_NAMES = {
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

function extractTimeValue(cellContent) {
  const timeMatch = cellContent.match(/class="cDM"[^>]*>([0-9:]+)</);
  return timeMatch ? timeMatch[1] : null;
}

function extractMonthYear(htmlContent) {
  let month = 0;
  let year = 0;

  const monthYearMatch = htmlContent.match(
    /id="ctl00_mp_calendar_monthChanged"[^>]*>([^<]+)<\/span>/
  );
  if (monthYearMatch) {
    const monthYearText = monthYearMatch[1];

    const yearMatch = monthYearText.match(/\d{4}/);
    if (yearMatch) {
      year = parseInt(yearMatch[0]);
    }

    for (const [monthName, monthNum] of Object.entries(MONTH_NAMES)) {
      if (monthYearText.includes(monthName)) {
        month = monthNum;
        break;
      }
    }
  }

  const currentMonthMatch = htmlContent.match(
    /id="ctl00_mp_currentMonth"\s+value="(\d{2})\/(\d{2})\/(\d{4})"/
  );
  if (currentMonthMatch) {
    month = parseInt(currentMonthMatch[2]);
    year = parseInt(currentMonthMatch[3]);
  }

  return { month, year };
}

function sortTimeEntries(timeEntries) {
  return timeEntries.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split("/").map(Number);
    const [dayB, monthB, yearB] = b.date.split("/").map(Number);

    if (yearA !== yearB) return yearA - yearB;
    if (monthA !== monthB) return monthA - monthB;
    return dayA - dayB;
  });
}

function extractWorkHours(htmlContent) {
  const timeEntries = [];
  const { month, year } = extractMonthYear(htmlContent);
  
  console.log('🔍 Searching for time entries...');
  
  // Try to find any table row that contains Days attribute and day number
  const rowPattern = /<tr[^>]*>(.*?)<\/tr>/gs;
  let rowMatch;
  let processedDays = new Set();
  
  while ((rowMatch = rowPattern.exec(htmlContent)) !== null) {
    const rowContent = rowMatch[1];
    
    // Look for Days attribute
    const daysMatch = rowContent.match(/Days="(\d+)"/);
    if (!daysMatch) continue;
    
    const offsetFromEpoch = parseInt(daysMatch[1]);
    
    // Skip if already processed
    if (processedDays.has(offsetFromEpoch)) continue;
    
    // Look for day number (dTS class)
    const dayNumMatch = rowContent.match(/class="dTS">(\d+)<\/td>/);
    if (!dayNumMatch) continue;
    
    const displayDay = parseInt(dayNumMatch[1]);
    
    // Calculate the actual date
    const exactDate = new Date(EPOCH_DATE);
    exactDate.setDate(EPOCH_DATE.getDate() + offsetFromEpoch);
    
    const day = exactDate.getDate();
    const calculatedMonth = exactDate.getMonth() + 1;
    const calculatedYear = exactDate.getFullYear();
    const dayOfWeek = WEEKDAYS[exactDate.getDay()];
    
    // Look for time value - try multiple patterns
    let timeValue = null;
    const timePatterns = [
      /class="cDM"[^>]*>([0-9:]+)</,
      /class="[^"]*time[^"]*"[^>]*>([0-9:]+)</i,
      />([0-9]+:[0-9]+)</,
      /(\d{1,2}:\d{2})/
    ];
    
    for (const pattern of timePatterns) {
      const match = rowContent.match(pattern);
      if (match && /^\d+:\d+$/.test(match[1])) {
        timeValue = match[1];
        break;
      }
    }
    
    // Look for holiday/special day marker
    const isSpecialDay = rowContent.includes('calendarCpecialDay');
    const holidayMatch = rowContent.match(/title="([^"]+)"/);
    const holidayName = isSpecialDay && holidayMatch ? holidayMatch[1] : null;
    
    const isWeekend = exactDate.getDay() === 5 || exactDate.getDay() === 6;
    const isHoliday = isSpecialDay || isWeekend;
    
    console.log(`  📅 Found day ${day}/${calculatedMonth}: time="${timeValue || '---'}", weekday="${dayOfWeek}", holiday="${holidayName || 'none'}"`);
    
    timeEntries.push({
      date: `${day}/${calculatedMonth}/${calculatedYear}`,
      day: dayOfWeek,
      time: timeValue || '---',
      offsetFromEpoch: offsetFromEpoch,
      holidayName: holidayName,
      isHoliday: isHoliday
    });
    
    processedDays.add(offsetFromEpoch);
  }
  
  console.log('  Total entries found:', timeEntries.length);
  
  if (timeEntries.length === 0) {
    console.log("Primary method failed, trying fallback methods...");
    return parseWorkHoursFallback1(htmlContent, EPOCH_DATE);
  }
  
  return sortTimeEntries(timeEntries);
}

// Add this debug function to your server.js after extractWorkHours function
function debugHtmlStructure(htmlContent) {
  console.log('\n=== DEBUG: HTML Structure Analysis ===');
  
  // Check for various possible class names
  const patterns = [
    /class="cDM"/g,
    /class="cdm"/g,
    /class="[^"]*DM[^"]*"/g,
    /class="[^"]*Time[^"]*"/g,
    /class="dTS">(\d+)<\/td>.*?<td[^>]*>([^<]*)<\/td>/gs
  ];
  
  patterns.forEach((pattern, index) => {
    const matches = htmlContent.match(pattern);
    console.log(`Pattern ${index + 1}:`, matches ? `${matches.length} matches` : 'No matches');
    if (matches && matches.length > 0) {
      console.log('Sample:', matches.slice(0, 3));
    }
  });
}

function parseWorkHoursFallback1(htmlContent, epochDate) {
  const timeEntries = [];

  const specialDaysPattern =
    /<td\s+title="([^"]+)"\s+class="calendarCpecialDay"[^>]*Days="(\d+)"[^>]*>.*?<td\s+class="dTS">(\d+)<\/td>.*?<td\s+class="cDM"[^>]*>([^<]*)<\/td>/gs;

  let specialMatch;
  while ((specialMatch = specialDaysPattern.exec(htmlContent)) !== null) {
    const holidayTitle = specialMatch[1].trim();
    const offsetFromEpoch = parseInt(specialMatch[2]);
    const displayDay = parseInt(specialMatch[3]);
    const holidayText = specialMatch[4].trim();

    const exactDate = new Date(epochDate);
    exactDate.setDate(epochDate.getDate() + offsetFromEpoch);

    const day = exactDate.getDate();
    const calculatedMonth = exactDate.getMonth() + 1;
    const calculatedYear = exactDate.getFullYear();
    const dayOfWeek = WEEKDAYS[exactDate.getDay()];

    timeEntries.push({
      date: `${day}/${calculatedMonth}/${calculatedYear}`,
      day: dayOfWeek,
      time: "---",
      offsetFromEpoch: offsetFromEpoch,
      holidayName: holidayText || holidayTitle,
      isHoliday: true,
    });
  }

  const dayRows = htmlContent.split("<tr>");

  dayRows.forEach((row) => {
    const daysMatch = row.match(/Days="(\d+)"/);
    const dayMatch = row.match(/class="dTS">(\d+)<\/td>/);
    const dayTypeMatch = row.match(/class="cDM"[^>]*>([^<]*)<\/td>/);

    if (daysMatch && dayMatch && dayTypeMatch) {
      const offsetFromEpoch = parseInt(daysMatch[1]);

      if (
        timeEntries.some((entry) => entry.offsetFromEpoch === offsetFromEpoch)
      ) {
        return;
      }

      const displayDay = parseInt(dayMatch[1]);
      const dayTypeText = dayTypeMatch[1].trim();

      let isOrdinaryWeekday =
        dayTypeText === "&nbsp;" ||
        dayTypeText === "" ||
        /^\d+:\d+$/.test(dayTypeText);

      const exactDate = new Date(epochDate);
      exactDate.setDate(epochDate.getDate() + offsetFromEpoch);

      const day = exactDate.getDate();
      const calculatedMonth = exactDate.getMonth() + 1;
      const calculatedYear = exactDate.getFullYear();
      const dayOfWeek = WEEKDAYS[exactDate.getDay()];

      isOrdinaryWeekday =
        isOrdinaryWeekday &&
        exactDate.getDay() !== 5 &&
        exactDate.getDay() !== 6;

      const timeMatch = row.match(/class="cDM"[^>]*>([0-9:]+)</);
      const time = timeMatch ? timeMatch[1].trim() : null;

      timeEntries.push({
        date: `${day}/${calculatedMonth}/${calculatedYear}`,
        day: dayOfWeek,
        time: time || "---",
        offsetFromEpoch: offsetFromEpoch,
        holidayName:
          isOrdinaryWeekday ||
          dayTypeText === "&nbsp;" ||
          dayTypeText === "" ||
          dayTypeText === null
            ? null
            : dayTypeText,
        isHoliday: !isOrdinaryWeekday,
      });
    }
  });

  return timeEntries;
}

function parseWorkHoursFallback2(htmlContent, month, year, epochDate) {
  const timeEntries = [];

  const specialDaysPattern =
    /<td\s+title="([^"]+)"\s+class="calendarCpecialDay"[^>]*>.*?<td\s+class="dTS">(\d+)<\/td>.*?<td\s+class="cDM"[^>]*>([^<]*)<\/td>/gs;

  let specialMatch;
  while ((specialMatch = specialDaysPattern.exec(htmlContent)) !== null) {
    const holidayTitle = specialMatch[1].trim();
    const displayDay = parseInt(specialMatch[2]);
    const holidayText = specialMatch[3].trim();

    const date = new Date(year, month - 1, displayDay);
    const dayOfWeek = WEEKDAYS[date.getDay()];

    timeEntries.push({
      date: `${displayDay}/${month}/${year}`,
      day: dayOfWeek,
      time: "---",
      holidayName: holidayText || holidayTitle,
      isHoliday: true,
    });
  }

  const dayRows = htmlContent.split("<tr>");

  dayRows.forEach((row) => {
    if (row.includes('class="dTS"') && row.includes('class="cDM"')) {
      const dayMatch = row.match(/class="dTS">(\d+)<\/td>/);
      const dayTypeMatch = row.match(/class="cDM"[^>]*>([^<]*)<\/td>/);

      if (dayMatch && dayTypeMatch) {
        const day = parseInt(dayMatch[1]);

        if (
          timeEntries.some((entry) => {
            const [entryDay] = entry.date.split("/").map(Number);
            return entryDay === day;
          })
        ) {
          return;
        }

        const dayTypeText = dayTypeMatch[1].trim();
        let isOrdinaryWeekday =
          dayTypeText === "&nbsp;" ||
          dayTypeText === "" ||
          /^\d+:\d+$/.test(dayTypeText);

        const date = new Date(year, month - 1, day);
        const dayOfWeek = WEEKDAYS[date.getDay()];
        isOrdinaryWeekday =
          isOrdinaryWeekday && date.getDay() !== 5 && date.getDay() !== 6;

        const timeMatch = row.match(/class="cDM"[^>]*>([0-9:]+)</);
        const time = timeMatch ? timeMatch[1].trim() : null;

        timeEntries.push({
          date: `${day}/${month}/${year}`,
          day: dayOfWeek,
          time: time || "---",
          holidayName:
            isOrdinaryWeekday ||
            dayTypeText === "&nbsp;" ||
            dayTypeText === "" ||
            dayTypeText === null
              ? null
              : dayTypeText,
          isHoliday: !isOrdinaryWeekday,
        });
      }
    }
  });

  return timeEntries;
}

function getAllDaysInMonth(timeEntries) {
  if (!timeEntries || timeEntries.length === 0) {
    return [];
  }

  const firstEntry = timeEntries[0];
  const [day, month, year] = firstEntry.date.split("/").map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const entriesByDay = {};

  timeEntries.forEach((entry) => {
    const [entryDay] = entry.date.split("/").map(Number);
    entriesByDay[entryDay] = entry;
  });

  const allDays = [];
  for (let dayOfMonth = 1; dayOfMonth <= lastDayOfMonth; dayOfMonth++) {
    const currentDate = new Date(year, month - 1, dayOfMonth);
    const dayOfWeek = WEEKDAYS[currentDate.getDay()];

    if (entriesByDay[dayOfMonth]) {
      allDays.push(entriesByDay[dayOfMonth]);
    } else {
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

function formatTimeInHebrew(hours, minutes) {
  return `${hours} שעות ${minutes > 0 ? `${minutes} דקות` : ""}`;
}

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

  timeEntries.forEach((entry) => {
    if (
      entry.day !== "Friday" &&
      entry.day !== "Saturday" &&
      !entry.isHoliday
    ) {
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

function calculateTotalTime(timeEntries) {
  let totalMinutes = 0;

  timeEntries.forEach((entry) => {
    if (entry.time && entry.time.match(/^\d+:\d+$/)) {
      const [hours, minutes] = entry.time.split(":").map(Number);
      totalMinutes += hours * 60 + minutes;
    }
  });

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const allDaysInMonth = getAllDaysInMonth(timeEntries);
  const monthlyRequirement = calculateMonthlyRequirement(allDaysInMonth);

  const totalCompletedMinutes = totalMinutes;
  const totalRequiredMinutes = monthlyRequirement.totalRequiredMinutes;
  const remainingRequiredMinutes = Math.max(
    0,
    totalRequiredMinutes - totalCompletedMinutes
  );

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
    duration: `${totalHours}:${
      remainingMinutes < 10 ? "0" + remainingMinutes : remainingMinutes
    }`,
    monthlyRequirement,
  };
}

app.post("/api/hilan-data", async (req, res) => {
  try {
    const { orgId, username, password } = req.body;

    console.log("=== STEP 1: Validating input ===");
    if (!orgId || !username || !password) {
      console.log("❌ Missing credentials");
      return res.status(400).json({
        success: false,
        error: "נדרשים מזהה ארגון,מספר עובד וסיסמה",
      });
    }
    console.log("✅ Input validated:", { orgId, username });

    console.log("\n=== STEP 2: Attempting login ===");
    const loginResponse = await fetch(
      "https://motorola.net.hilan.co.il/HilanCenter/Public/api/LoginApi/LoginRequest",
      {
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
      }
    );

    console.log("Login response status:", loginResponse.status);

    if (!loginResponse.ok) {
      console.log("❌ Login failed with status:", loginResponse.status);
      return res.status(loginResponse.status).json({
        success: false,
        error: `ההתחברות נכשלה עם סטטוס: ${loginResponse.status}`,
      });
    }

    const loginData = await loginResponse.json();
    console.log("✅ Login response received");
    console.log(
      "Login data:",
      JSON.stringify(loginData).substring(0, 200) + "..."
    );

    // FIXED: Check IsFail instead of isError
    if (loginData.IsFail) {
      // Changed this line
      console.log("❌ Login error:", loginData.ErrorMessage);
      return res.status(400).json({
        success: false,
        error: `שגיאת התחברות: ${loginData.ErrorMessage || "שגיאה לא ידועה"}`,
      });
    }
    console.log("✅ Login successful");

    console.log("\n=== STEP 3: Extracting cookies ===");
    const cookies = loginResponse.headers.raw()["set-cookie"];

    if (!cookies || cookies.length === 0) {
      console.log("❌ No cookies received");
      return res.status(500).json({
        success: false,
        error: "לא התקבלו עוגיות מההתחברות",
      });
    }

    console.log("✅ Cookies received:", cookies.length, "cookie(s)");
    console.log("First cookie preview:", cookies[0].substring(0, 100) + "...");

    const cookieString = cookies
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    console.log("Cookie string length:", cookieString.length);

    console.log("\n=== STEP 4: Fetching attendance page ===");
    const attendanceUrl =
      "https://motorola.net.hilan.co.il/Hilannetv2/Attendance/calendarpage.aspx?isPersonalFileMode=true&ReportPageMode=2";

    const attendanceResponse = await fetch(attendanceUrl, {
      method: "GET",
      headers: {
        Cookie: cookieString,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://motorola.net.hilan.co.il/",
      },
      redirect: "follow",
    });

    console.log("Attendance page status:", attendanceResponse.status);

    if (!attendanceResponse.ok) {
      console.log("❌ Failed to fetch attendance page");
      return res.status(attendanceResponse.status).json({
        success: false,
        error: `נכשל להביא נתוני נוכחות: ${attendanceResponse.status}`,
      });
    }

    const htmlContent = await attendanceResponse.text();
    console.log("✅ HTML content received, length:", htmlContent.length);

    fs.writeFileSync("debug_calendar.html", htmlContent, "utf8");
    console.log("📁 HTML saved to debug_calendar.html");

    console.log("\n=== STEP 5: Extracting month/year ===");
    const { month, year } = extractMonthYear(htmlContent);
    console.log("Calendar displaying:", { month, year });

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    console.log("Current date:", { currentMonth, currentYear });

    console.log("\n=== STEP 6: Extracting work hours ===");
    const timeEntries = extractWorkHours(htmlContent);
    console.log("Time entries found:", timeEntries.length);

    if (timeEntries.length === 0) {
      console.log("❌ No time entries found");

      let errorMessage = "לא נמצאו רשומות זמן בתגובה";

      if (
        year > currentYear ||
        (year === currentYear && month > currentMonth)
      ) {
        errorMessage = `הלוח שנה מציג חודש עתידי (${month}/${year}). אין נתונים זמינים עדיין.`;
        console.log("⚠️  Calendar showing future month");
      } else if (
        year < currentYear ||
        (year === currentYear && month < currentMonth)
      ) {
        errorMessage = `הלוח שנה מציג חודש עבר (${month}/${year}).`;
        console.log("⚠️  Calendar showing past month");
      }

      return res.status(404).json({
        success: false,
        error: errorMessage,
        debug: {
          displayedMonth: month,
          displayedYear: year,
          currentMonth,
          currentYear,
          htmlLength: htmlContent.length,
        },
      });
    }

    console.log("✅ Time entries extracted successfully");
    console.log("Sample entries (first 3):");
    timeEntries.slice(0, 3).forEach((entry, index) => {
      console.log(
        `  ${index + 1}. Date: ${entry.date}, Day: ${entry.day}, Time: ${
          entry.time
        }, Holiday: ${entry.holidayName || "N/A"}`
      );
    });

    console.log("\n=== STEP 7: Calculating total time ===");
    const result = calculateTotalTime(timeEntries);
    console.log("✅ Calculation complete");
    console.log("Results:");
    console.log("  Total hours:", result.totalHours);
    console.log("  Total minutes:", result.totalMinutes);
    console.log("  Formatted:", result.formatted);
    console.log("  Duration:", result.duration);
    console.log("  Monthly requirement:", result.monthlyRequirement);

    console.log("\n=== SUCCESS: Returning data to client ===");
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("\n=== ERROR OCCURRED ===");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);

    return res.status(500).json({
      success: false,
      error: error.message || "אירעה שגיאה לא ידועה",
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Open this address in your browser");
});

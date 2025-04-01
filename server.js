const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const EPOCH_DATE = new Date(2000, 0, 1); // Reference date for Hilan system: January 1, 2000
const MINUTES_PER_WORKDAY = 9 * 60; // 9 hours in minutes
const MINUTES_PER_THURSDAY = 8.5 * 60; // 8.5 hours in minutes for Thursday
const MONTH_NAMES = {
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6,
  'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
  'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
  'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Main function to extract work hours from Hilan HTML content
 * @param {string} htmlContent - The HTML content from Hilan
 * @returns {Array} - Array of time entries
 */
function extractWorkHours(htmlContent) {
  const timeEntries = [];
  
  // Extract month and year information
  const { month, year } = extractMonthYear(htmlContent);
  
  // First, try to extract days with holiday information using the calendarCpecialDay class
  const specialDaysPattern = /<td\s+title="([^"]+)"\s+class="calendarCpecialDay"[^>]*Days="(\d+)"[^>]*>.*?<td\s+class="dTS">(\d+)<\/td>.*?<td\s+class="cDM"[^>]*>([^<]*)<\/td>/gs;
  
  let specialMatch;
  while ((specialMatch = specialDaysPattern.exec(htmlContent)) !== null) {
    const holidayTitle = specialMatch[1].trim(); // From title attribute
    const offsetFromEpoch = parseInt(specialMatch[2]);
    const displayDay = parseInt(specialMatch[3]);
    const holidayText = specialMatch[4].trim(); // From cDM cell content
    
    // Calculate exact date based on Days attribute
    const exactDate = new Date(EPOCH_DATE);
    exactDate.setDate(EPOCH_DATE.getDate() + offsetFromEpoch);
    
    // Extract date components
    const day = exactDate.getDate();
    const calculatedMonth = exactDate.getMonth() + 1;
    const calculatedYear = exactDate.getFullYear();
    
    // Get day of week
    const dayOfWeek = WEEKDAYS[exactDate.getDay()];
    
    // Add the special day entry
    timeEntries.push({
      date: `${day}/${calculatedMonth}/${calculatedYear}`,
      day: dayOfWeek,
      time: '---',
      offsetFromEpoch: offsetFromEpoch,
      holidayName: holidayText || holidayTitle, // Use either the text in the cell or the title attribute
      isHoliday: true
    });
  }
  
  // Now extract regular days
  const dayCellPattern = /<td[^>]*class="cDIES[^"]*"[^>]*Days="(\d+)"[^>]*>.*?<td class="dTS">(\d+)<\/td>.*?<td class="cDM"[^>]*>([^<]*)<\/td>/gs;
  
  let match;
  while ((match = dayCellPattern.exec(htmlContent)) !== null) {
    const offsetFromEpoch = parseInt(match[1]); 
    const displayDay = parseInt(match[2]); 
    const dayTypeText = match[3].trim(); 

    // Skip this entry if we've already added it as a special day
    if (timeEntries.some(entry => entry.offsetFromEpoch === offsetFromEpoch)) {
      continue;
    }

    // Check if it's a regular workday or holiday
    let isOrdinaryWeekday = dayTypeText === '&nbsp;' || dayTypeText === '' || /^\d+:\d+$/.test(dayTypeText);
    
    // Calculate exact date based on Days attribute
    const exactDate = new Date(EPOCH_DATE);
    exactDate.setDate(EPOCH_DATE.getDate() + offsetFromEpoch);
    
    // Extract date components
    const day = exactDate.getDate();
    const calculatedMonth = exactDate.getMonth() + 1; // getMonth() is 0-indexed
    const calculatedYear = exactDate.getFullYear();
    
    // Get day of week
    const dayOfWeek = WEEKDAYS[exactDate.getDay()];

    // Refine isOrdinaryWeekday by excluding weekends (Friday, Saturday)
    isOrdinaryWeekday = isOrdinaryWeekday && (exactDate.getDay() !== 5 && exactDate.getDay() !== 6);
    
    // Extract time value if available
    let timeValue = extractTimeValue(match[0]);
    
    // Create and add the time entry
    timeEntries.push({
      date: `${day}/${calculatedMonth}/${calculatedYear}`,
      day: dayOfWeek,
      time: timeValue || '---',
      offsetFromEpoch: offsetFromEpoch, 
      holidayName: isOrdinaryWeekday || dayTypeText === "&nbsp;" || dayTypeText === "" || dayTypeText === null ? null : dayTypeText,
      isHoliday: !isOrdinaryWeekday
    });
  }
  
  // Try fallback methods if primary methods fail
  if (timeEntries.length === 0) {
    console.log("Primary method failed, trying fallback method 1...");
    return parseWorkHoursFallback1(htmlContent, EPOCH_DATE);
  }
  
  // Final fallback if first fallback fails and we have month/year
  if (timeEntries.length === 0 && month > 0 && year > 0) {
    console.log("Both primary methods failed, falling back to traditional method...");
    return parseWorkHoursFallback2(htmlContent, month, year, EPOCH_DATE);
  }
    
  // Sort entries by date
  return sortTimeEntries(timeEntries);
}

/**
 * Extract time value from a cell
 * @param {string} cellContent - HTML content of the cell
 * @returns {string|null} - Time value or null
 */
function extractTimeValue(cellContent) {
  const timeMatch = cellContent.match(/class="cDM"[^>]*>([0-9:]+)</);
  return timeMatch ? timeMatch[1] : null;
}

/**
 * Extract month and year from HTML content
 * @param {string} htmlContent - The HTML content
 * @returns {Object} - Month and year values
 */
function extractMonthYear(htmlContent) {
  let month = 0;
  let year = 0;
  
  // Try to extract from calendar element
  const monthYearMatch = htmlContent.match(/id="ctl00_mp_calendar_monthChanged"[^>]*>([^<]+)<\/span>/);
  if (monthYearMatch) {
    const monthYearText = monthYearMatch[1]; 
    
    // Extract year
    const yearMatch = monthYearText.match(/\d{4}/);
    if (yearMatch) {
      year = parseInt(yearMatch[0]);
    }
    
    // Extract month from text
    for (const [monthName, monthNum] of Object.entries(MONTH_NAMES)) {
      if (monthYearText.includes(monthName)) {
        month = monthNum;
        break;
      }
    }
  }
  
  // Try alternative method if first one fails
  const currentMonthMatch = htmlContent.match(/id="ctl00_mp_currentMonth"\s+value="(\d{2})\/(\d{2})\/(\d{4})"/);
  if (currentMonthMatch) {
    month = parseInt(currentMonthMatch[2]); // MM from DD/MM/YYYY
    year = parseInt(currentMonthMatch[3]); // YYYY from DD/MM/YYYY
  }
  
  return { month, year };
}

/**
 * Sort time entries by date
 * @param {Array} timeEntries - Array of time entries
 * @returns {Array} - Sorted time entries
 */
function sortTimeEntries(timeEntries) {
  return timeEntries.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split('/').map(Number);
    const [dayB, monthB, yearB] = b.date.split('/').map(Number);
    
    // Compare years, then months, then days
    if (yearA !== yearB) return yearA - yearB;
    if (monthA !== monthB) return monthA - monthB;
    return dayA - dayB;
  });
}

/**
 * Generate all days in a month
 * @param {Array} timeEntries - Array of time entries
 * @returns {Array} - Array with all days of the month
 */
function getAllDaysInMonth(timeEntries) {
  if (!timeEntries || timeEntries.length === 0) {
    return [];
  }
  
  const firstEntry = timeEntries[0];
  const [day, month, year] = firstEntry.date.split('/').map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const entriesByDay = {};

  // Map entries by day for easier access
  timeEntries.forEach(entry => {
    const [entryDay] = entry.date.split('/').map(Number);
    entriesByDay[entryDay] = entry;
  });
  
  // Create an array with all days of the month
  const allDays = [];
  for (let dayOfMonth = 1; dayOfMonth <= lastDayOfMonth; dayOfMonth++) {
    const currentDate = new Date(year, month - 1, dayOfMonth);
    const dayOfWeek = WEEKDAYS[currentDate.getDay()];
    
    if (entriesByDay[dayOfMonth]) {
      // Use existing entry
      allDays.push(entriesByDay[dayOfMonth]);
    } else {
      // Create placeholder for days without entries
      allDays.push({
        date: `${dayOfMonth}/${month}/${year}`,
        day: dayOfWeek,
        time: '---',
        isFutureDay: true
      });
    }
  }
  
  return allDays;
}

/**
 * Calculate monthly hour requirements
 * @param {Array} timeEntries - Array of time entries
 * @returns {Object} - Monthly requirement data
 */
function calculateMonthlyRequirement(timeEntries) {
  // Default values if no entries
  if (!timeEntries || timeEntries.length === 0) {
    return {
      totalRequiredHours: 0,
      totalRequiredMinutes: 0,
      totalRequiredFormatted: '0 שעות',
      completedHours: 0,
      completedMinutes: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingFormatted: '0 שעות'
    };
  }
  
  let totalRequiredMinutes = 0;
  
  // Count regular workdays (excluding weekends and holidays)
  timeEntries.forEach(entry => {
    // Skip weekends (Friday, Saturday) and holidays
    if ((entry.day !== 'Friday' && entry.day !== 'Saturday') && !entry.isHoliday) {
      // Thursday has 8.5 hours instead of 9
      if (entry.day === 'Thursday') {
        totalRequiredMinutes += MINUTES_PER_THURSDAY;
      } else {
        totalRequiredMinutes += MINUTES_PER_WORKDAY;
      }
    }
  });
  
  const totalRequiredHours = Math.floor(totalRequiredMinutes / 60);
  const totalRequiredRemainingMinutes = totalRequiredMinutes % 60;
  
  // Format results
  return {
    totalRequiredHours,
    totalRequiredMinutes,
    totalRequiredFormatted: formatTimeInHebrew(totalRequiredHours, totalRequiredRemainingMinutes),
    completedHours: 0, // Will be updated in client
    completedMinutes: 0,
    remainingHours: totalRequiredHours,
    remainingMinutes: totalRequiredRemainingMinutes,
    remainingFormatted: formatTimeInHebrew(totalRequiredHours, totalRequiredRemainingMinutes)
  };
}

/**
 * Format time values in Hebrew
 * @param {number} hours - Hours
 * @param {number} minutes - Minutes
 * @returns {string} - Formatted time in Hebrew
 */
function formatTimeInHebrew(hours, minutes) {
  return `${hours} שעות ${minutes > 0 ? `${minutes} דקות` : ''}`;
}

/**
 * Calculate total work time from entries
 * @param {Array} timeEntries - Array of time entries
 * @returns {Object} - Total time data
 */
function calculateTotalTime(timeEntries) {
  let totalMinutes = 0;
  
  // Sum up all valid time entries
  timeEntries.forEach(entry => {
    if (entry.time && entry.time.match(/^\d+:\d+$/)) {
      const [hours, minutes] = entry.time.split(':').map(Number);
      totalMinutes += (hours * 60) + minutes;
    }
  });
  
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  // Get all days and calculate monthly requirements
  const allDaysInMonth = getAllDaysInMonth(timeEntries);
  const monthlyRequirement = calculateMonthlyRequirement(allDaysInMonth);
  
  // Calculate remaining required minutes
  const totalCompletedMinutes = totalMinutes;
  const totalRequiredMinutes = monthlyRequirement.totalRequiredMinutes;
  const remainingRequiredMinutes = Math.max(0, totalRequiredMinutes - totalCompletedMinutes);
  
  // Update monthly requirement with completed data
  monthlyRequirement.completedHours = totalHours;
  monthlyRequirement.completedMinutes = remainingMinutes;
  monthlyRequirement.remainingHours = Math.floor(remainingRequiredMinutes / 60);
  monthlyRequirement.remainingMinutes = remainingRequiredMinutes % 60;
  monthlyRequirement.remainingFormatted = formatTimeInHebrew(
    monthlyRequirement.remainingHours, 
    monthlyRequirement.remainingMinutes
  );
  
  // Return complete result
  return {
    entries: allDaysInMonth,
    totalHours,
    totalMinutes,
    remainingMinutes,
    formatted: formatTimeInHebrew(totalHours, remainingMinutes),
    duration: `${totalHours}:${remainingMinutes < 10 ? '0' + remainingMinutes : remainingMinutes}`,
    monthlyRequirement
  };
}

/**
 * Fallback method 1 for parsing work hours
 * @param {string} htmlContent - HTML content from Hilan
 * @param {Date} epochDate - Reference date
 * @returns {Array} - Array of time entries
 */
function parseWorkHoursFallback1(htmlContent, epochDate) {
  const timeEntries = [];
  
  // First try to extract special days
  const specialDaysPattern = /<td\s+title="([^"]+)"\s+class="calendarCpecialDay"[^>]*Days="(\d+)"[^>]*>.*?<td\s+class="dTS">(\d+)<\/td>.*?<td\s+class="cDM"[^>]*>([^<]*)<\/td>/gs;
  
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
      time: '---',
      offsetFromEpoch: offsetFromEpoch,
      holidayName: holidayText || holidayTitle,
      isHoliday: true
    });
  }
  
  // Then extract regular days
  const dayRows = htmlContent.split('<tr>');
  
  dayRows.forEach(row => {
    const daysMatch = row.match(/Days="(\d+)"/);
    const dayMatch = row.match(/class="dTS">(\d+)<\/td>/);
    const dayTypeMatch = row.match(/class="cDM"[^>]*>([^<]*)<\/td>/);
    
    if (daysMatch && dayMatch && dayTypeMatch) {
      const offsetFromEpoch = parseInt(daysMatch[1]);
      
      // Skip if already added as a special day
      if (timeEntries.some(entry => entry.offsetFromEpoch === offsetFromEpoch)) {
        return;
      }
      
      const displayDay = parseInt(dayMatch[1]);
      const dayTypeText = dayTypeMatch[1].trim();

      // Check if regular workday
      let isOrdinaryWeekday = dayTypeText === '&nbsp;' || dayTypeText === '' || /^\d+:\d+$/.test(dayTypeText);
      
      // Calculate exact date
      const exactDate = new Date(epochDate);
      exactDate.setDate(epochDate.getDate() + offsetFromEpoch);
      
      const day = exactDate.getDate();
      const calculatedMonth = exactDate.getMonth() + 1;
      const calculatedYear = exactDate.getFullYear();
      const dayOfWeek = WEEKDAYS[exactDate.getDay()];

      // Refine check excluding weekends
      isOrdinaryWeekday = isOrdinaryWeekday && (exactDate.getDay() !== 5 && exactDate.getDay() !== 6);
      
      // Extract time
      const timeMatch = row.match(/class="cDM"[^>]*>([0-9:]+)</);
      const time = timeMatch ? timeMatch[1].trim() : null;
      
      // Add the entry
      timeEntries.push({
        date: `${day}/${calculatedMonth}/${calculatedYear}`,
        day: dayOfWeek,
        time: time || '---',
        offsetFromEpoch: offsetFromEpoch,
        holidayName: isOrdinaryWeekday || dayTypeText === "&nbsp;" || dayTypeText === "" || dayTypeText === null ? null : dayTypeText,
        isHoliday: !isOrdinaryWeekday
      });
    }
  });
  
  return timeEntries;
}

/**
 * Fallback method 2 for parsing work hours
 * @param {string} htmlContent - HTML content from Hilan
 * @param {number} month - Month number
 * @param {number} year - Year
 * @param {Date} epochDate - Reference date
 * @returns {Array} - Array of time entries
 */
function parseWorkHoursFallback2(htmlContent, month, year, epochDate) {
  const timeEntries = [];
  
  // First try to extract special days (holidays)
  const specialDaysPattern = /<td\s+title="([^"]+)"\s+class="calendarCpecialDay"[^>]*>.*?<td\s+class="dTS">(\d+)<\/td>.*?<td\s+class="cDM"[^>]*>([^<]*)<\/td>/gs;
  
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
      time: '---',
      holidayName: holidayText || holidayTitle,
      isHoliday: true
    });
  }
  
  // Then extract regular days
  const dayRows = htmlContent.split('<tr>');
  
  dayRows.forEach(row => {
    if (row.includes('class="dTS"') && row.includes('class="cDM"')) {
      const dayMatch = row.match(/class="dTS">(\d+)<\/td>/);
      const dayTypeMatch = row.match(/class="cDM"[^>]*>([^<]*)<\/td>/);
      
      if (dayMatch && dayTypeMatch) {
        const day = parseInt(dayMatch[1]);
        
        // Skip if already added as a special day
        if (timeEntries.some(entry => {
          const [entryDay] = entry.date.split('/').map(Number);
          return entryDay === day;
        })) {
          return;
        }
        
        const dayTypeText = dayTypeMatch[1].trim();

        // Check if regular workday
        let isOrdinaryWeekday = dayTypeText === '&nbsp;' || dayTypeText === '' || /^\d+:\d+$/.test(dayTypeText);
        
        // Calculate date
        const date = new Date(year, month - 1, day);
        const dayOfWeek = WEEKDAYS[date.getDay()];

        // Refine check excluding weekends
        isOrdinaryWeekday = isOrdinaryWeekday && (date.getDay() !== 5 && date.getDay() !== 6);
        
        // Extract time
        const timeMatch = row.match(/class="cDM"[^>]*>([0-9:]+)</);
        const time = timeMatch ? timeMatch[1].trim() : null;
        
        // Add the entry
        timeEntries.push({
          date: `${day}/${month}/${year}`,
          day: dayOfWeek,
          time: time || '---',
          holidayName: isOrdinaryWeekday || dayTypeText === "&nbsp;" || dayTypeText === "" || dayTypeText === null ? null : dayTypeText,
          isHoliday: !isOrdinaryWeekday
        });
      }
    }
  });
  
  return timeEntries;
}

// API route for Hilan data
app.post('/api/hilan-data', async (req, res) => {
  try {
    const { orgId, username, password, isEn } = req.body;
    
    // Validate required fields
    if (!orgId || !username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'נדרשים מזהה ארגון,מספר עובד וסיסמה' 
      });
    }
    
    // Step 1: Login to get session cookies
    const loginResponse = await fetch('https://motorola.net.hilan.co.il/HilanCenter/Public/api/LoginApi/LoginRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        username,
        password,
        isEn: false // Always use Hebrew
      })
    });
    
    // Handle login response errors
    if (!loginResponse.ok) {
      return res.status(loginResponse.status).json({
        success: false,
        error: `ההתחברות נכשלה עם סטטוס: ${loginResponse.status}`
      });
    }
    
    const loginData = await loginResponse.json();
    
    if (loginData.isError) {
      return res.status(400).json({
        success: false,
        error: `שגיאת התחברות: ${loginData.errorMessage || 'שגיאה לא ידועה'}`
      });
    }
    
    // Get cookies from response
    const cookies = loginResponse.headers.raw()['set-cookie'];
    
    if (!cookies || cookies.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'לא התקבלו עוגיות מההתחברות. לא ניתן להמשיך.'
      });
    }
    
    // Step 2: Fetch attendance data
    const attendanceUrl = 'https://motorola.net.hilan.co.il/Hilannetv2/Attendance/calendarpage.aspx?isPersonalFileMode=true&ReportPageMode=2';
    
    const attendanceResponse = await fetch(attendanceUrl, {
      headers: { 'Cookie': cookies.join('; ') }
    });
    
    if (!attendanceResponse.ok) {
      return res.status(attendanceResponse.status).json({
        success: false,
        error: `נכשל להביא נתוני נוכחות: ${attendanceResponse.status}`
      });
    }
    
    // Step 3: Process HTML content
    const htmlContent = await attendanceResponse.text();
    const timeEntries = extractWorkHours(htmlContent);
    
    if (timeEntries.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'לא נמצאו רשומות זמן בתגובה.'
      });
    }
    
    // Step 4: Calculate total hours and return result
    const result = calculateTotalTime(timeEntries);
    
    return res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'אירעה שגיאה לא ידועה'
    });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Open this address in your browser');
});
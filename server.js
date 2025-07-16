const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const EPOCH_DATE = new Date(2000, 0, 1);
const MINUTES_PER_WORKDAY = 9 * 60;
const MINUTES_PER_THURSDAY = 8.5 * 60;
const MONTH_NAMES = {
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6,
  'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
  'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
  'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function extractTimeValue(cellContent) {
  const timeMatch = cellContent.match(/class="cDM"[^>]*>([0-9:]+)</);
  return timeMatch ? timeMatch[1] : null;
}

function extractMonthYear(htmlContent) {
  let month = 0;
  let year = 0;
  
  const monthYearMatch = htmlContent.match(/id="ctl00_mp_calendar_monthChanged"[^>]*>([^<]+)<\/span>/);
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
  
  const currentMonthMatch = htmlContent.match(/id="ctl00_mp_currentMonth"\s+value="(\d{2})\/(\d{2})\/(\d{4})"/);
  if (currentMonthMatch) {
    month = parseInt(currentMonthMatch[2]);
    year = parseInt(currentMonthMatch[3]);
  }
  
  return { month, year };
}

function sortTimeEntries(timeEntries) {
  return timeEntries.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split('/').map(Number);
    const [dayB, monthB, yearB] = b.date.split('/').map(Number);
    
    if (yearA !== yearB) return yearA - yearB;
    if (monthA !== monthB) return monthA - monthB;
    return dayA - dayB;
  });
}

function extractWorkHours(htmlContent) {
  const timeEntries = [];
  const { month, year } = extractMonthYear(htmlContent);
  
  const specialDaysPattern = /<td\s+title="([^"]+)"\s+class="calendarCpecialDay"[^>]*Days="(\d+)"[^>]*>.*?<td\s+class="dTS">(\d+)<\/td>.*?<td\s+class="cDM"[^>]*>([^<]*)<\/td>/gs;
  
  let specialMatch;
  while ((specialMatch = specialDaysPattern.exec(htmlContent)) !== null) {
    const holidayTitle = specialMatch[1].trim();
    const offsetFromEpoch = parseInt(specialMatch[2]);
    const displayDay = parseInt(specialMatch[3]);
    const holidayText = specialMatch[4].trim();
    
    const exactDate = new Date(EPOCH_DATE);
    exactDate.setDate(EPOCH_DATE.getDate() + offsetFromEpoch);
    
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
  
  const dayCellPattern = /<td[^>]*class="cDIES[^"]*"[^>]*Days="(\d+)"[^>]*>.*?<td class="dTS">(\d+)<\/td>.*?<td class="cDM"[^>]*>([^<]*)<\/td>/gs;
  
  let match;
  while ((match = dayCellPattern.exec(htmlContent)) !== null) {
    const offsetFromEpoch = parseInt(match[1]); 
    const displayDay = parseInt(match[2]); 
    const dayTypeText = match[3].trim(); 

    if (timeEntries.some(entry => entry.offsetFromEpoch === offsetFromEpoch)) {
      continue;
    }

    let isOrdinaryWeekday = dayTypeText === '&nbsp;' || dayTypeText === '' || /^\d+:\d+$/.test(dayTypeText);
    
    const exactDate = new Date(EPOCH_DATE);
    exactDate.setDate(EPOCH_DATE.getDate() + offsetFromEpoch);
    
    const day = exactDate.getDate();
    const calculatedMonth = exactDate.getMonth() + 1;
    const calculatedYear = exactDate.getFullYear();
    const dayOfWeek = WEEKDAYS[exactDate.getDay()];

    isOrdinaryWeekday = isOrdinaryWeekday && (exactDate.getDay() !== 5 && exactDate.getDay() !== 6);
    
    let timeValue = extractTimeValue(match[0]);
    
    timeEntries.push({
      date: `${day}/${calculatedMonth}/${calculatedYear}`,
      day: dayOfWeek,
      time: timeValue || '---',
      offsetFromEpoch: offsetFromEpoch, 
      holidayName: isOrdinaryWeekday || dayTypeText === "&nbsp;" || dayTypeText === "" || dayTypeText === null ? null : dayTypeText,
      isHoliday: !isOrdinaryWeekday
    });
  }
  
  if (timeEntries.length === 0) {
    console.log("Primary method failed, trying fallback method 1...");
    return parseWorkHoursFallback1(htmlContent, EPOCH_DATE);
  }
  
  if (timeEntries.length === 0 && month > 0 && year > 0) {
    console.log("Both primary methods failed, falling back to traditional method...");
    return parseWorkHoursFallback2(htmlContent, month, year, EPOCH_DATE);
  }
    
  return sortTimeEntries(timeEntries);
}

function parseWorkHoursFallback1(htmlContent, epochDate) {
  const timeEntries = [];
  
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
  
  const dayRows = htmlContent.split('<tr>');
  
  dayRows.forEach(row => {
    const daysMatch = row.match(/Days="(\d+)"/);
    const dayMatch = row.match(/class="dTS">(\d+)<\/td>/);
    const dayTypeMatch = row.match(/class="cDM"[^>]*>([^<]*)<\/td>/);
    
    if (daysMatch && dayMatch && dayTypeMatch) {
      const offsetFromEpoch = parseInt(daysMatch[1]);
      
      if (timeEntries.some(entry => entry.offsetFromEpoch === offsetFromEpoch)) {
        return;
      }
      
      const displayDay = parseInt(dayMatch[1]);
      const dayTypeText = dayTypeMatch[1].trim();

      let isOrdinaryWeekday = dayTypeText === '&nbsp;' || dayTypeText === '' || /^\d+:\d+$/.test(dayTypeText);
      
      const exactDate = new Date(epochDate);
      exactDate.setDate(epochDate.getDate() + offsetFromEpoch);
      
      const day = exactDate.getDate();
      const calculatedMonth = exactDate.getMonth() + 1;
      const calculatedYear = exactDate.getFullYear();
      const dayOfWeek = WEEKDAYS[exactDate.getDay()];

      isOrdinaryWeekday = isOrdinaryWeekday && (exactDate.getDay() !== 5 && exactDate.getDay() !== 6);
      
      const timeMatch = row.match(/class="cDM"[^>]*>([0-9:]+)</);
      const time = timeMatch ? timeMatch[1].trim() : null;
      
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

function parseWorkHoursFallback2(htmlContent, month, year, epochDate) {
  const timeEntries = [];
  
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
  
  const dayRows = htmlContent.split('<tr>');
  
  dayRows.forEach(row => {
    if (row.includes('class="dTS"') && row.includes('class="cDM"')) {
      const dayMatch = row.match(/class="dTS">(\d+)<\/td>/);
      const dayTypeMatch = row.match(/class="cDM"[^>]*>([^<]*)<\/td>/);
      
      if (dayMatch && dayTypeMatch) {
        const day = parseInt(dayMatch[1]);
        
        if (timeEntries.some(entry => {
          const [entryDay] = entry.date.split('/').map(Number);
          return entryDay === day;
        })) {
          return;
        }
        
        const dayTypeText = dayTypeMatch[1].trim();
        let isOrdinaryWeekday = dayTypeText === '&nbsp;' || dayTypeText === '' || /^\d+:\d+$/.test(dayTypeText);
        
        const date = new Date(year, month - 1, day);
        const dayOfWeek = WEEKDAYS[date.getDay()];
        isOrdinaryWeekday = isOrdinaryWeekday && (date.getDay() !== 5 && date.getDay() !== 6);
        
        const timeMatch = row.match(/class="cDM"[^>]*>([0-9:]+)</);
        const time = timeMatch ? timeMatch[1].trim() : null;
        
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

function getAllDaysInMonth(timeEntries) {
  if (!timeEntries || timeEntries.length === 0) {
    return [];
  }
  
  const firstEntry = timeEntries[0];
  const [day, month, year] = firstEntry.date.split('/').map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const entriesByDay = {};

  timeEntries.forEach(entry => {
    const [entryDay] = entry.date.split('/').map(Number);
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
        time: '---',
        isFutureDay: true
      });
    }
  }
  
  return allDays;
}

function formatTimeInHebrew(hours, minutes) {
  return `${hours} שעות ${minutes > 0 ? `${minutes} דקות` : ''}`;
}

function calculateMonthlyRequirement(timeEntries) {
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
  
  timeEntries.forEach(entry => {
    if ((entry.day !== 'Friday' && entry.day !== 'Saturday') && !entry.isHoliday) {
      if (entry.day === 'Thursday') {
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
    totalRequiredFormatted: formatTimeInHebrew(totalRequiredHours, totalRequiredRemainingMinutes),
    completedHours: 0,
    completedMinutes: 0,
    remainingHours: totalRequiredHours,
    remainingMinutes: totalRequiredRemainingMinutes,
    remainingFormatted: formatTimeInHebrew(totalRequiredHours, totalRequiredRemainingMinutes)
  };
}

function calculateTotalTime(timeEntries) {
  let totalMinutes = 0;
  
  timeEntries.forEach(entry => {
    if (entry.time && entry.time.match(/^\d+:\d+$/)) {
      const [hours, minutes] = entry.time.split(':').map(Number);
      totalMinutes += (hours * 60) + minutes;
    }
  });
  
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  const allDaysInMonth = getAllDaysInMonth(timeEntries);
  const monthlyRequirement = calculateMonthlyRequirement(allDaysInMonth);
  
  const totalCompletedMinutes = totalMinutes;
  const totalRequiredMinutes = monthlyRequirement.totalRequiredMinutes;
  const remainingRequiredMinutes = Math.max(0, totalRequiredMinutes - totalCompletedMinutes);
  
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
    duration: `${totalHours}:${remainingMinutes < 10 ? '0' + remainingMinutes : remainingMinutes}`,
    monthlyRequirement
  };
}

app.post('/api/hilan-data', async (req, res) => {
  try {
    const { orgId, username, password, isEn } = req.body;
    
    if (!orgId || !username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'נדרשים מזהה ארגון,מספר עובד וסיסמה' 
      });
    }
    
    const loginResponse = await fetch('https://motorola.net.hilan.co.il/HilanCenter/Public/api/LoginApi/LoginRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        username,
        password,
        isEn: false
      })
    });
    
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
    
    const cookies = loginResponse.headers.raw()['set-cookie'];
    
    if (!cookies || cookies.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'לא התקבלו עוגיות מההתחברות. לא ניתן להמשיך.'
      });
    }
    
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
    
    const htmlContent = await attendanceResponse.text();
    const timeEntries = extractWorkHours(htmlContent);
    
    if (timeEntries.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'לא נמצאו רשומות זמן בתגובה'
      });
    }
    
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Open this address in your browser');
});
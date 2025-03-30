// DOM Elements with efficient caching
const elements = {
    // Main UI containers
    loginForm: document.getElementById('login-form'),
    loginCard: document.getElementById('login-card'),
    resultsCard: document.getElementById('results-card'),
    errorCard: document.getElementById('error-card'),
    loader: document.getElementById('loader'),
    
    // Error handling elements
    errorMessage: document.getElementById('error-message'),
    tryAgainButton: document.getElementById('try-again'),
    
    // Table view elements
    hoursTableBody: document.getElementById('hours-table-body'),
    totalFormatted: document.getElementById('total-formatted'),
    
    // Summary elements
    regularWorkdaysElement: document.getElementById('regular-workdays'),
    totalDaysElement: document.getElementById('total-days'),
    totalHoursElement: document.getElementById('total-hours'),
    dailyAverageElement: document.getElementById('daily-average'),
    dailyRequiredHoursElement: document.getElementById('daily-required-hours'),
    monthlyRequirementElement: document.getElementById('monthly-requirement'),
    remainingHoursElement: document.getElementById('remaining-hours'),
    completionPercentageElement: document.getElementById('completion-percentage'),
    
    // View toggle elements
    exportCsvButton: document.getElementById('export-csv'),
    printResultsButton: document.getElementById('print-results'),
    toggleViewButton: document.getElementById('toggle-view'),
    tableView: document.getElementById('table-view'),
    calendarView: document.getElementById('calendar-view'),
    calendarGrid: document.getElementById('calendar-grid'),
    calendarMonthName: document.getElementById('calendar-month-name'),
    
    // Status cards
    requiredHoursCard: document.getElementById('required-hours-card'),
    remainingHoursCard: document.getElementById('remaining-hours-card'),
    completionCard: document.getElementById('completion-card')
  };
  
  // Global variables
  let workingDayTypes = {}; // Store day types keyed by date
  let allMonthEntries = []; // Store all month entries
  let currentView = 'calendar'; // Current view state - Can be 'table' or 'calendar'
  
  // Constants
  const DAY_TYPES = {
    REGULAR: 'יום עבודה',
    VACATION: 'חופש'
  };
  
  const STATUS_CLASSES = {
    LOW: 'low-completion',
    MID: 'mid-completion',
    HIGH: 'high-completion',
    COMPLETE: 'complete-completion',
    COMPLETED: 'completed-hours',
    NEARLY_COMPLETED: 'nearly-completed-hours',
    PENDING: 'pending-hours'
  };
  
  // Hebrew day names
  const hebrewDayNames = {
    'Sunday': 'ראשון',
    'Monday': 'שני',
    'Tuesday': 'שלישי',
    'Wednesday': 'רביעי',
    'Thursday': 'חמישי',
    'Friday': 'שישי',
    'Saturday': 'שבת'
  };
  
  // Hebrew month names
  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  
  // Helper functions
  function parseDate(dateString) {
    return dateString.split('/').map(Number);
  }
  
  function createDateObject(day, month, year) {
    return new Date(year, month - 1, day);
  }
  
  function isWeekend(dayName) {
    return dayName === 'Friday' || dayName === 'Saturday';
  }
  
  function isValidTimeFormat(timeString) {
    return timeString && timeString.match(/^\d+:\d+$/);
  }
  
  function createVacationBadge() {
    const badge = document.createElement('span');
    badge.className = 'vacation-badge';
    badge.textContent = 'חופשה';
    return badge;
  }
  
  function updateElementClass(element, classesToRemove, classToAdd) {
    if (!element) return;
    
    if (Array.isArray(classesToRemove)) {
      element.classList.remove(...classesToRemove);
    }
    
    if (classToAdd) {
      element.classList.add(classToAdd);
    }
  }
  
  // Function to toggle between table and calendar views
  function toggleView() {
    if (currentView === 'table') {
      // Switch to calendar view
      elements.tableView.classList.add('hidden');
      elements.calendarView.classList.remove('hidden');
      elements.toggleViewButton.innerHTML = '<i class="fas fa-table"></i> מעבר לתצוגת טבלה';
      currentView = 'calendar';
      
      // Generate calendar if we have data
      if (allMonthEntries && allMonthEntries.length > 0) {
        generateCalendarView();
        
        // Sync calendar with current workingDayTypes
        syncCalendarView();
      }
    } else {
      // Switch to table view
      elements.calendarView.classList.add('hidden');
      elements.tableView.classList.remove('hidden');
      elements.toggleViewButton.innerHTML = '<i class="fas fa-calendar-alt"></i> מעבר לתצוגת לוח שנה';
      currentView = 'table';
      
      // Sync table with current workingDayTypes
      syncTableView();
    }
  }
  
  // Function to sync calendar view with workingDayTypes
  function syncCalendarView() {
    document.querySelectorAll('.day-type-select-calendar').forEach(select => {
      const date = select.dataset.date;
      if (workingDayTypes[date]) {
        select.value = workingDayTypes[date];
        
        // Update visual appearance based on the type
        const dayCell = select.closest('.calendar-day');
        if (workingDayTypes[date] === DAY_TYPES.VACATION) {
          dayCell.classList.add('vacation-day');
          if (!dayCell.querySelector('.vacation-badge')) {
            dayCell.insertBefore(createVacationBadge(), dayCell.firstChild);
          }
        } else {
          dayCell.classList.remove('vacation-day');
          const badge = dayCell.querySelector('.vacation-badge');
          if (badge) {
            dayCell.removeChild(badge);
          }
        }
      }
    });
  }
  
  // Function to sync table view with workingDayTypes
  function syncTableView() {
    document.querySelectorAll('.day-type-select').forEach(select => {
      const date = select.dataset.date;
      if (workingDayTypes[date]) {
        select.value = workingDayTypes[date];
        
        // Update row styling
        const row = select.closest('tr');
        if (row) {
          if (workingDayTypes[date] === DAY_TYPES.VACATION) {
            row.classList.add('vacation-day-row');
          } else {
            row.classList.remove('vacation-day-row');
          }
        }
      }
    });
  }
  
  // Function to handle day type change
  function handleDayTypeChange(date, type) {
    // Update the global working day types object
    workingDayTypes[date] = type;
    
    // Recalculate the required hours
    recalculateRequiredHours();
    
    // Update calendar view element
    const calendarSelect = document.querySelector(`.day-type-select-calendar[data-date="${date}"]`);
    if (calendarSelect) {
      calendarSelect.value = type;
      
      // Update the day cell appearance
      const dayCell = calendarSelect.closest('.calendar-day');
      if (dayCell) {
        if (type === DAY_TYPES.VACATION) {
          dayCell.classList.add('vacation-day');
          if (!dayCell.querySelector('.vacation-badge')) {
            dayCell.insertBefore(createVacationBadge(), dayCell.firstChild);
          }
        } else {
          dayCell.classList.remove('vacation-day');
          const badge = dayCell.querySelector('.vacation-badge');
          if (badge) {
            dayCell.removeChild(badge);
          }
        }
      }
    }
    
    // Update table view element
    const tableSelect = document.querySelector(`.day-type-select[data-date="${date}"]`);
    if (tableSelect) {
      tableSelect.value = type;
      
      // Update the row styling
      const row = tableSelect.closest('tr');
      if (row) {
        if (type === DAY_TYPES.VACATION) {
          row.classList.add('vacation-day-row');
        } else {
          row.classList.remove('vacation-day-row');
        }
      }
    }
  }
  
  // Function to recalculate required hours based on day types
  function recalculateRequiredHours() {
    if (!allMonthEntries || allMonthEntries.length === 0) return;
    
    let totalRequiredMinutes = 0;
    const minutesPerWorkday = 9 * 60;
    let regularWorkdaysCount = 0;
    let remainingWorkdaysCount = 0;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Count completed days for the ratio display
    const completedDays = allMonthEntries.filter(entry => 
      !entry.isFutureDay && 
      entry.time && 
      entry.time !== '---' && 
      isValidTimeFormat(entry.time)
    ).length;
    
    allMonthEntries.forEach(entry => {
      const dayType = workingDayTypes[entry.date] || DAY_TYPES.REGULAR;
      
      if (dayType === DAY_TYPES.REGULAR) {
        const [day, month, year] = parseDate(entry.date);
        const entryDate = createDateObject(day, month, year);
        const dayOfWeek = entryDate.getDay();
        
        regularWorkdaysCount++;
        
        // Count remaining work days (today and future days)
        if (entryDate >= currentDate) {
          remainingWorkdaysCount++;
        }
        
        if (dayOfWeek === 4) {
          totalRequiredMinutes += 8.5 * 60;
        } else {
          totalRequiredMinutes += minutesPerWorkday;
        }
      }
    });
    
    // Update regular workdays with the ratio format: regular / completed
    elements.regularWorkdaysElement.textContent = regularWorkdaysCount + " / " + completedDays;
    
    const totalRequiredHours = Math.floor(totalRequiredMinutes / 60);
    const totalRequiredRemainingMinutes = totalRequiredMinutes % 60;
    
    const totalHoursText = elements.totalHoursElement.textContent;
    let completedHours = 0;
    let completedMinutes = 0;
    
    const completedMatch = totalHoursText.match(/(\d+) שעות(?: ו-?(\d+) דקות)?/);
    if (completedMatch) {
      completedHours = parseInt(completedMatch[1], 10) || 0;
      completedMinutes = parseInt(completedMatch[2], 10) || 0;
    }
    
    const totalCompletedMinutes = (completedHours * 60) + completedMinutes;
    const remainingRequiredMinutes = Math.max(0, totalRequiredMinutes - totalCompletedMinutes);
    
    const remainingHours = Math.floor(remainingRequiredMinutes / 60);
    const remainingMinutes = remainingRequiredMinutes % 60;
    
    // Calculate daily required hours in hours and minutes
    let dailyRequiredHours = 0;
    let dailyRequiredMinutes = 0;
    
    if (remainingWorkdaysCount > 0) {
      const totalDailyRequiredMinutes = Math.round(remainingRequiredMinutes / remainingWorkdaysCount);
      dailyRequiredHours = Math.floor(totalDailyRequiredMinutes / 60);
      dailyRequiredMinutes = totalDailyRequiredMinutes % 60;
    }
    
    const safeRequiredMinutes = Math.max(1, totalRequiredMinutes);
    const completionPercentage = (totalCompletedMinutes / safeRequiredMinutes) * 100;
    const formattedPercentage = completionPercentage.toFixed(1);
    
    elements.monthlyRequirementElement.textContent = `${totalRequiredHours} שעות ${totalRequiredRemainingMinutes > 0 ? `${totalRequiredRemainingMinutes} דקות` : ''}`;
    elements.remainingHoursElement.textContent = `${remainingHours} שעות ${remainingMinutes > 0 ? `${remainingMinutes} דקות` : ''}`;
    
    // Format daily required hours in X:Y format
    const formattedDailyMinutes = dailyRequiredMinutes < 10 ? `0${dailyRequiredMinutes}` : dailyRequiredMinutes;
    elements.dailyRequiredHoursElement.textContent = `${dailyRequiredHours}:${formattedDailyMinutes}`;
    
    if (elements.completionPercentageElement) {
      elements.completionPercentageElement.textContent = `${formattedPercentage}%`;
      
      if (elements.completionCard) {
        updateElementClass(
          elements.completionCard, 
          [STATUS_CLASSES.LOW, STATUS_CLASSES.MID, STATUS_CLASSES.HIGH, STATUS_CLASSES.COMPLETE]
        );
        
        if (completionPercentage < 50) {
          elements.completionCard.classList.add(STATUS_CLASSES.LOW);
        } else if (completionPercentage < 80) {
          elements.completionCard.classList.add(STATUS_CLASSES.MID);
        } else if (completionPercentage < 100) {
          elements.completionCard.classList.add(STATUS_CLASSES.HIGH);
        } else {
          elements.completionCard.classList.add(STATUS_CLASSES.COMPLETE);
        }
      }
    }
    
    if (elements.remainingHoursCard) {
      updateElementClass(
        elements.remainingHoursCard, 
        [STATUS_CLASSES.COMPLETED, STATUS_CLASSES.NEARLY_COMPLETED, STATUS_CLASSES.PENDING]
      );
      
      const hoursRemaining = remainingRequiredMinutes / 60;
      if (hoursRemaining <= 0) {
        elements.remainingHoursCard.classList.add(STATUS_CLASSES.COMPLETED);
      } else if (hoursRemaining >= 5 && hoursRemaining < 10) {
        elements.remainingHoursCard.classList.add(STATUS_CLASSES.NEARLY_COMPLETED);
      } else {
        elements.remainingHoursCard.classList.add(STATUS_CLASSES.PENDING);
      }
    }
  }
  
// Function to generate the calendar view
function generateCalendarView() {
  elements.calendarGrid.innerHTML = '';
  
  if (!allMonthEntries || allMonthEntries.length === 0) return;
  
  const [day, month, year] = parseDate(allMonthEntries[0].date);
  
  elements.calendarMonthName.textContent = `${hebrewMonths[month-1]} ${year}`;
  
  const firstDayOfMonth = createDateObject(1, month, year);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  // Create a map of entries by day for easier access
  const entriesByDay = {};
  allMonthEntries.forEach(entry => {
    const [entryDay] = parseDate(entry.date);
    entriesByDay[entryDay] = entry;
  });
  
  // Add empty cells for days before the 1st of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    elements.calendarGrid.appendChild(emptyCell);
  }
  
  // Create cells for each day of the month
  for (let dayOfMonth = 1; dayOfMonth <= lastDayOfMonth; dayOfMonth++) {
    const dayCell = document.createElement('div');
    const dayDate = createDateObject(dayOfMonth, month, year);
    const dayOfWeek = dayDate.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isFutureDay = dayDate > currentDate;
    const isPastDay = dayDate < currentDate;
    const isCurrentDay = dayDate.toDateString() === currentDate.toDateString();
    
    // Build class list based on day properties
    let dayClasses = 'calendar-day';
    if (isWeekend) {
      dayClasses += ' weekend';
      dayClasses += ' vacation-day'; // Keep the vacation-day class for the orange background
    }
    if (isFutureDay) dayClasses += ' future-day';
    if (isPastDay) dayClasses += ' past-day';
    if (isCurrentDay) dayClasses += ' current-day';
    
    dayCell.className = dayClasses;
    
    const entry = entriesByDay[dayOfMonth];
    
    // Determine day type based on various factors
    const dayType = workingDayTypes[`${dayOfMonth}/${month}/${year}`] || 
                  (isWeekend || (entry && entry.isHoliday) ? DAY_TYPES.VACATION : DAY_TYPES.REGULAR);
    
    // Add vacation styling if needed (only add badge for non-weekend vacation days)
    if (dayType === DAY_TYPES.VACATION && !isWeekend) {
      dayCell.classList.add('vacation-day');
      dayCell.appendChild(createVacationBadge());
    }
    
    // Add day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = dayOfMonth;
    dayCell.appendChild(dayNumber);
    
    // Add hours if present
    if (entry && entry.time && isValidTimeFormat(entry.time)) {
      const dayHours = document.createElement('div');
      dayHours.className = 'day-hours';
      dayHours.textContent = entry.time;
      dayCell.appendChild(dayHours);
    }
    
    // Add holiday name if present
    if (entry && entry.holidayName) {
      const holidayNameEl = document.createElement('div');
      holidayNameEl.className = 'holiday-name';
      holidayNameEl.textContent = entry.holidayName;
      dayCell.appendChild(holidayNameEl);
    }
    
    // Add day type selector or display - but only for non-weekend days
    if (!isWeekend) {
      const dayTypeContainer = document.createElement('div');
      dayTypeContainer.className = 'day-type';
      
      // Regular dropdown for non-weekend days
      const dayTypeSelect = document.createElement('select');
      dayTypeSelect.className = 'day-type-select-calendar';
      dayTypeSelect.dataset.date = `${dayOfMonth}/${month}/${year}`;
      
      // Regular day option
      const regularOption = document.createElement('option');
      regularOption.value = DAY_TYPES.REGULAR;
      regularOption.textContent = DAY_TYPES.REGULAR;
      regularOption.selected = dayType === DAY_TYPES.REGULAR && !(entry && entry.isHoliday);
      
      // Vacation day option
      const vacationOption = document.createElement('option');
      vacationOption.value = DAY_TYPES.VACATION;
      vacationOption.textContent = DAY_TYPES.VACATION;
      vacationOption.selected = dayType === DAY_TYPES.VACATION || (entry && entry.isHoliday);
      
      dayTypeSelect.appendChild(regularOption);
      dayTypeSelect.appendChild(vacationOption);
      dayTypeContainer.appendChild(dayTypeSelect);
      dayCell.appendChild(dayTypeContainer);
    }
    
    // Store the value in workingDayTypes for weekend days
    if (isWeekend) {
      workingDayTypes[`${dayOfMonth}/${month}/${year}`] = DAY_TYPES.VACATION;
    }
    
    elements.calendarGrid.appendChild(dayCell);
  }
  
  // Add event listeners to day type selectors
  document.querySelectorAll('.day-type-select-calendar').forEach(select => {
    select.addEventListener('change', function() {
      const date = this.dataset.date;
      const type = this.value;
      
      // Handle UI update for the calendar day
      const dayCell = this.closest('.calendar-day');
      if (type === DAY_TYPES.VACATION) {
        dayCell.classList.add('vacation-day');
        if (!dayCell.querySelector('.vacation-badge')) {
          dayCell.insertBefore(createVacationBadge(), dayCell.firstChild);
        }
      } else {
        dayCell.classList.remove('vacation-day');
        const badge = dayCell.querySelector('.vacation-badge');
        if (badge) {
          dayCell.removeChild(badge);
        }
      }
      
      // Update the global state and other views
      handleDayTypeChange(date, type);
    });
  });
}
  
  // Helper function to calculate daily average
  function calculateDailyAverage(totalMinutes, days) {
    if (!days || days === 0) return '0:00';
    
    const avgMinutes = Math.round(totalMinutes / days);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    
    return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
  }
  
  // Function to format hours and minutes in Hebrew
  function formatHoursMinutes(hours, minutes) {
    let result = '';
    
    if (hours === 1) {
      result = 'שעה אחת';
    } else {
      result = `${hours} שעות`;
    }
    
    if (minutes > 0) {
      if (minutes === 1) {
        result += ' ודקה אחת';
      } else {
        result += ` ו-${minutes} דקות`;
      }
    }
    
    return result;
  }
  
// Function to display work hours in the table and calendar views
function displayWorkHours(result) {
  elements.hoursTableBody.innerHTML = '';
  
  allMonthEntries = result.entries;
  
  result.entries.forEach(entry => {
    if (!workingDayTypes[entry.date]) {
      if (isWeekend(entry.day) || entry.isHoliday) {
        workingDayTypes[entry.date] = DAY_TYPES.VACATION;
      } else {
        workingDayTypes[entry.date] = DAY_TYPES.REGULAR;
      }
    }
  });
  
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  let regularWorkdaysCount = 0;
  result.entries.forEach(entry => {
    if (!isWeekend(entry.day) && !entry.isHoliday && 
        workingDayTypes[entry.date] === DAY_TYPES.REGULAR) {
      regularWorkdaysCount++;
    }
  });
  
  // Count completed days
  const completedDays = result.entries.filter(entry => 
    !entry.isFutureDay && 
    entry.time && 
    entry.time !== '---' && 
    isValidTimeFormat(entry.time)
  ).length;
  
  // Display ratio format of regular/completed days
  elements.regularWorkdaysElement.textContent = regularWorkdaysCount + " / " + completedDays;
  
  result.entries.forEach(entry => {
    const row = document.createElement('tr');
    
    const weekendClass = isWeekend(entry.day) ? 'weekend-day' : '';
    const isEntryWeekend = isWeekend(entry.day);
    
    const [day, month, year] = parseDate(entry.date);
    const entryDate = createDateObject(day, month, year);
    const isFutureDay = entryDate > currentDate;
    const isPastDay = entryDate < currentDate;
    
    let hours = 0;
    let minutes = 0;
    let timeDisplay = entry.time;
    let hebrewHoursMinutes = '---';
    
    if (isValidTimeFormat(entry.time)) {
      [hours, minutes] = entry.time.split(':').map(Number);
      hebrewHoursMinutes = formatHoursMinutes(hours, minutes);
    }
    
    const hebrewDate = `${day}/${month}/${year}`;
    
    const hebrewDay = hebrewDayNames[entry.day] || entry.day;
    
    let dayTypeHTML = '';
    if (isEntryWeekend) {
      // For weekends, display nothing in the type column
      dayTypeHTML = '';
      // Ensure working day type is set to vacation for weekends
      workingDayTypes[entry.date] = DAY_TYPES.VACATION;
    } else {
      // Regular dropdown for non-weekend days
      dayTypeHTML = `
        <select class="day-type-select" data-date="${entry.date}">
          <option value="${DAY_TYPES.REGULAR}" ${workingDayTypes[entry.date] === DAY_TYPES.REGULAR ? 'selected' : ''}>${DAY_TYPES.REGULAR}</option>
          <option value="${DAY_TYPES.VACATION}" ${workingDayTypes[entry.date] === DAY_TYPES.VACATION ? 'selected' : ''}>${DAY_TYPES.VACATION}</option>
        </select>
      `;
    }
    
    let rowClasses = [];
    if (isFutureDay) rowClasses.push('future-day');
    if (isPastDay) rowClasses.push('past-day-row');
    if (entryDate.toDateString() === currentDate.toDateString()) rowClasses.push('current-day-row');
    if (workingDayTypes[entry.date] === DAY_TYPES.VACATION || entry.isHoliday || entry.holidayName) rowClasses.push('vacation-day-row');
    
    row.className = rowClasses.join(' ');
    row.innerHTML = `
      <td>${hebrewDate}</td>
      <td class="${weekendClass}">${hebrewDay}</td>
      <td>${hebrewHoursMinutes}</td>
      <td>${entry.holidayName ? entry.holidayName : '---'}</td>
      <td>${dayTypeHTML}</td>
    `;
    
    elements.hoursTableBody.appendChild(row);
  });
  
  document.querySelectorAll('.day-type-select').forEach(select => {
    select.addEventListener('change', function() {
      const date = this.dataset.date;
      const type = this.value;
      
      const row = this.closest('tr');
      if (row) {
        if (type === DAY_TYPES.VACATION) {
          row.classList.add('vacation-day-row');
        } else {
          row.classList.remove('vacation-day-row');
        }
      }
      
      handleDayTypeChange(date, type);
    });
  });
  
  const hebrewFormatted = formatHoursMinutes(result.totalHours, result.remainingMinutes);
  elements.totalFormatted.textContent = hebrewFormatted;
  
  elements.totalHoursElement.textContent = hebrewFormatted;
  elements.dailyAverageElement.textContent = calculateDailyAverage(result.totalMinutes, completedDays);
  
  if (result.monthlyRequirement) {
    elements.monthlyRequirementElement.textContent = result.monthlyRequirement.totalRequiredFormatted;
    elements.remainingHoursElement.textContent = result.monthlyRequirement.remainingFormatted;
  }
  
  recalculateRequiredHours();
  
  if (currentView === 'calendar') {
    generateCalendarView();
  }
}
  
  // Function to export table to CSV
  function exportToCsv() {
    // Create CSV content with Hebrew headers - removed משך
    let csvContent = "תאריך,יום,שעות,חג,סוג\n";
    
    // Add table rows
    Array.from(elements.hoursTableBody.querySelectorAll('tr')).forEach(row => {
      const cells = row.querySelectorAll('td');
      const dayTypeSelect = row.querySelector('.day-type-select');
      const dayType = dayTypeSelect ? dayTypeSelect.value : DAY_TYPES.REGULAR;
      
      // Create an array of cell values - adjusted indices
      const rowData = [
        `"${cells[0].textContent}"`, // Date
        `"${cells[1].textContent}"`, // Day
        `"${cells[2].textContent}"`, // Hours (was index 3)
        `"${cells[3].textContent}"`, // Holiday (was index 4)
        `"${dayType}"`               // Type
      ];
      
      csvContent += rowData.join(',') + "\n";
    });
    
    // Add total row - removed totalDuration reference
    csvContent += `"סה״כ",,"${elements.totalFormatted.textContent}",""\n`;
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'שעות_חילן.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  // UI state management functions
  function showLoading() {
    elements.loginCard.classList.add('hidden');
    elements.resultsCard.classList.add('hidden');
    elements.errorCard.classList.add('hidden');
    elements.loader.classList.remove('hidden');
  }
  
  function showError(message) {
    elements.loginCard.classList.add('hidden');
    elements.resultsCard.classList.add('hidden');
    elements.loader.classList.add('hidden');
    
    // Translate common error messages to Hebrew
    if (message.includes('Login failed')) {
      message = 'ההתחברות נכשלה. אנא בדוק את פרטי ההתחברות שלך.';
    } else if (message.includes('No time entries found')) {
      message = 'לא נמצאו רשומות זמן בחודש הנוכחי.';
    } else if (message.includes('Failed to fetch')) {
      message = 'אין חיבור לשרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.';
    }
    
    elements.errorMessage.textContent = message;
    elements.errorCard.classList.remove('hidden');
  }
  
  function showResults() {
    elements.loginCard.classList.add('hidden');
    elements.errorCard.classList.add('hidden');
    elements.loader.classList.add('hidden');
    elements.resultsCard.classList.remove('hidden');
    
    // Set view to calendar by default
    elements.tableView.classList.add('hidden');
    elements.calendarView.classList.remove('hidden');
    elements.toggleViewButton.innerHTML = '<i class="fas fa-table"></i> מעבר לתצוגת טבלה';
    currentView = 'calendar';
    
    // Generate calendar view
    if (allMonthEntries && allMonthEntries.length > 0) {
      generateCalendarView();
    }
  }
  
  function resetForm() {
    elements.errorCard.classList.add('hidden');
    elements.resultsCard.classList.add('hidden');
    elements.loader.classList.add('hidden');
    elements.loginCard.classList.remove('hidden');
  }
  
  // Data retrieval
  async function fetchHilanData(credentials) {
    try {
      showLoading();
      
      // Always use Hebrew interface
      credentials.isEn = false;
      
      // Send login credentials to our server
      const response = await fetch('/api/hilan-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'נכשל לקבל נתונים מחילן');
      }
      
      // Process and display the data
      displayWorkHours(data.data);
      showResults();
      
    } catch (error) {
      console.error('Error:', error);
      showError(error.message || 'אירעה שגיאה לא ידועה');
    }
  }
  
  // Function to print results
  function printResults() {
    window.print();
  }
  
  // Initialize event listeners
// Initialize event listeners
function initEventListeners() {
    // Form submission
    elements.loginForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const credentials = {
        orgId: document.getElementById('orgId').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        isEn: false // Always use Hebrew
      };
      
      fetchHilanData(credentials);
    });
    
    // Other UI controls
    elements.tryAgainButton.addEventListener('click', resetForm);
    elements.exportCsvButton.addEventListener('click', exportToCsv);
    elements.printResultsButton.addEventListener('click', printResults);
    elements.toggleViewButton.addEventListener('click', toggleView);
   }
   
   // Initialize the application
   initEventListeners();
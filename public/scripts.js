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
    totalDuration: document.getElementById('total-duration'),
    totalFormatted: document.getElementById('total-formatted'),
    
    // Summary elements
    totalDaysElement: document.getElementById('total-days'),
    totalHoursElement: document.getElementById('total-hours'),
    dailyAverageElement: document.getElementById('daily-average'),
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
    REGULAR: 'יום רגיל',
    VACATION: 'יום חופשה'
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
    const minutesPerWorkday = 9 * 60; // 9 hours in minutes
    
    // Calculate based on day types
    allMonthEntries.forEach(entry => {
      // Get day type for this date
      const dayType = workingDayTypes[entry.date] || DAY_TYPES.REGULAR;
      
      // Only add required hours for regular workdays
      if (dayType === DAY_TYPES.REGULAR) {
        const [day, month, year] = parseDate(entry.date);
        const entryDate = createDateObject(day, month, year);
        const dayOfWeek = entryDate.getDay();
        
        if (dayOfWeek === 4) { // Thursday
          totalRequiredMinutes += 8.5 * 60;
        } else {
          // Add regular 9 hours for other days
          totalRequiredMinutes += minutesPerWorkday;
        }
      }
    });
    
    const totalRequiredHours = Math.floor(totalRequiredMinutes / 60);
    const totalRequiredRemainingMinutes = totalRequiredMinutes % 60;
    
    // Get current completed hours
    const totalHoursText = elements.totalHoursElement.textContent;
    let completedHours = 0;
    let completedMinutes = 0;
    
    // Parse completed hours from the display
    const completedMatch = totalHoursText.match(/(\d+) שעות(?: ו-?(\d+) דקות)?/);
    if (completedMatch) {
      completedHours = parseInt(completedMatch[1], 10) || 0;
      completedMinutes = parseInt(completedMatch[2], 10) || 0;
    }
    
    const totalCompletedMinutes = (completedHours * 60) + completedMinutes;
    const remainingRequiredMinutes = Math.max(0, totalRequiredMinutes - totalCompletedMinutes);
    
    const remainingHours = Math.floor(remainingRequiredMinutes / 60);
    const remainingMinutes = remainingRequiredMinutes % 60;
    
    // Calculate completion percentage
    const safeRequiredMinutes = Math.max(1, totalRequiredMinutes); // Avoid division by zero
    const completionPercentage = (totalCompletedMinutes / safeRequiredMinutes) * 100;
    const formattedPercentage = completionPercentage.toFixed(1);
    
    // Update the display
    elements.monthlyRequirementElement.textContent = `${totalRequiredHours} שעות ${totalRequiredRemainingMinutes > 0 ? `${totalRequiredRemainingMinutes} דקות` : ''}`;
    elements.remainingHoursElement.textContent = `${remainingHours} שעות ${remainingMinutes > 0 ? `${remainingMinutes} דקות` : ''}`;
    
    // Update completion percentage display
    if (elements.completionPercentageElement) {
      elements.completionPercentageElement.textContent = `${formattedPercentage}%`;
      
      // Add classes based on completion percentage
      if (elements.completionCard) {
        // Remove all status classes
        updateElementClass(
          elements.completionCard, 
          [STATUS_CLASSES.LOW, STATUS_CLASSES.MID, STATUS_CLASSES.HIGH, STATUS_CLASSES.COMPLETE]
        );
        
        // Add appropriate class based on percentage
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
    
    // Update card styling based on remaining hours
    if (elements.remainingHoursCard) {
      // Reset classes
      updateElementClass(
        elements.remainingHoursCard, 
        [STATUS_CLASSES.COMPLETED, STATUS_CLASSES.NEARLY_COMPLETED, STATUS_CLASSES.PENDING]
      );
      
      // Add appropriate class based on hours remaining
      const hoursRemaining = remainingRequiredMinutes / 60;
      if (hoursRemaining < 5) {
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
      const isCurrentDay = dayDate.toDateString() === currentDate.toDateString();
      
      // Build class list based on day properties
      let dayClasses = 'calendar-day';
      if (isWeekend) dayClasses += ' weekend';
      if (isFutureDay) dayClasses += ' future-day';
      if (isCurrentDay) dayClasses += ' current-day';
      
      dayCell.className = dayClasses;
      
      const entry = entriesByDay[dayOfMonth];
      
      // Determine day type based on various factors
      const dayType = workingDayTypes[`${dayOfMonth}/${month}/${year}`] || 
                     (isWeekend || (entry && entry.isHoliday) ? DAY_TYPES.VACATION : DAY_TYPES.REGULAR);
      
      // Add vacation styling if needed
      if (dayType === DAY_TYPES.VACATION) {
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
      
      // Add day type selector
      const dayTypeContainer = document.createElement('div');
      dayTypeContainer.className = 'day-type';
      
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
    // Clear previous results
    elements.hoursTableBody.innerHTML = '';
    
    // Store all entries for later recalculation
    allMonthEntries = result.entries;
    
    // Initialize day types for all entries
    result.entries.forEach(entry => {
      if (!workingDayTypes[entry.date]) {
        // Default to יום חופשה for weekends, holidays, יום רגיל for other days
        if (isWeekend(entry.day) || entry.isHoliday) {
          workingDayTypes[entry.date] = DAY_TYPES.VACATION;
        } else {
          workingDayTypes[entry.date] = DAY_TYPES.REGULAR;
        }
      }
    });
    
    // Current date for comparison
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Generate table rows for each entry
    result.entries.forEach(entry => {
      const row = document.createElement('tr');
      
      const weekendClass = isWeekend(entry.day) ? 'weekend-day' : '';
      
      // Parse date components
      const [day, month, year] = parseDate(entry.date);
      const entryDate = createDateObject(day, month, year);
      const isFutureDay = entryDate > currentDate;
      
      // Process time data
      let hours = 0;
      let minutes = 0;
      let timeDisplay = entry.time;
      let hebrewHoursMinutes = '---';
      
      if (isValidTimeFormat(entry.time)) {
        [hours, minutes] = entry.time.split(':').map(Number);
        hebrewHoursMinutes = formatHoursMinutes(hours, minutes);
      }
      
      // Format date for display
      const hebrewDate = `${day}/${month}/${year}`;
      
      // Translate day name to Hebrew
      const hebrewDay = hebrewDayNames[entry.day] || entry.day;
      
      // Create the day type dropdown
      const dayTypeDropdown = `
        <select class="day-type-select" data-date="${entry.date}">
          <option value="${DAY_TYPES.REGULAR}" ${workingDayTypes[entry.date] === DAY_TYPES.REGULAR ? 'selected' : ''}>${DAY_TYPES.REGULAR}</option>
          <option value="${DAY_TYPES.VACATION}" ${workingDayTypes[entry.date] === DAY_TYPES.VACATION ? 'selected' : ''}>${DAY_TYPES.VACATION}</option>
        </select>
      `;
      
      // Set row classes
      let rowClasses = [];
      if (isFutureDay) rowClasses.push('future-day');
      if (entryDate.toDateString() === currentDate.toDateString()) rowClasses.push('current-day-row');
      if (workingDayTypes[entry.date] === DAY_TYPES.VACATION || entry.isHoliday || entry.holidayName) rowClasses.push('vacation-day-row');
      
      row.className = rowClasses.join(' ');
      row.innerHTML = `
        <td>${hebrewDate}</td>
        <td class="${weekendClass}">${hebrewDay}</td>
        <td>${timeDisplay}</td>
        <td>${hebrewHoursMinutes}</td>
        <td>${entry.holidayName ? entry.holidayName : '---'}</td>
        <td>${dayTypeDropdown}</td>
      `;
      
      elements.hoursTableBody.appendChild(row);
    });
    
    // Add event listeners to day type dropdowns
    document.querySelectorAll('.day-type-select').forEach(select => {
      select.addEventListener('change', function() {
        const date = this.dataset.date;
        const type = this.value;
        
        // Update the row styling directly for immediate feedback
        const row = this.closest('tr');
        if (row) {
          if (type === DAY_TYPES.VACATION) {
            row.classList.add('vacation-day-row');
          } else {
            row.classList.remove('vacation-day-row');
          }
        }
        
        // Update global state and other views
        handleDayTypeChange(date, type);
      });
    });
    
    // Update totals
    elements.totalDuration.textContent = result.duration;
    
    // Format total hours and minutes in Hebrew
    const hebrewFormatted = formatHoursMinutes(result.totalHours, result.remainingMinutes);
    elements.totalFormatted.textContent = hebrewFormatted;
    
    // Count completed work days
    const completedDays = result.entries.filter(entry => 
      !entry.isFutureDay && 
      entry.time && 
      entry.time !== '---' && 
      isValidTimeFormat(entry.time)
    ).length;
    
    // Update summary cards
    elements.totalDaysElement.textContent = completedDays;
    elements.totalHoursElement.textContent = hebrewFormatted;
    elements.dailyAverageElement.textContent = calculateDailyAverage(result.totalMinutes, completedDays);
    
    // Update monthly requirement information
    if (result.monthlyRequirement) {
      elements.monthlyRequirementElement.textContent = result.monthlyRequirement.totalRequiredFormatted;
      elements.remainingHoursElement.textContent = result.monthlyRequirement.remainingFormatted;
    }
    
    // Calculate required hours with our custom rules
    recalculateRequiredHours();
    
    // Show current view
    if (currentView === 'calendar') {
      generateCalendarView();
    }
  }
  
  // Function to export table to CSV
  function exportToCsv() {
    // Create CSV content with Hebrew headers
    let csvContent = "תאריך,יום,משך,שעות,חג,סוג\n";
    
    // Add table rows
    Array.from(elements.hoursTableBody.querySelectorAll('tr')).forEach(row => {
      const cells = row.querySelectorAll('td');
      const dayTypeSelect = row.querySelector('.day-type-select');
      const dayType = dayTypeSelect ? dayTypeSelect.value : DAY_TYPES.REGULAR;
      
      // Create an array of cell values
      const rowData = [
        `"${cells[0].textContent}"`, // Date
        `"${cells[1].textContent}"`, // Day
        `"${cells[2].textContent}"`, // Duration
        `"${cells[3].textContent}"`, // Hours
        `"${cells[4].textContent}"`, // Holiday
        `"${dayType}"`               // Type
      ];
      
      csvContent += rowData.join(',') + "\n";
    });
    
    // Add total row
    csvContent += `"סה״כ",,"${elements.totalDuration.textContent}","${elements.totalFormatted.textContent}",""\n`;
    
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
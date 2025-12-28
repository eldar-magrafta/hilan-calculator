// ============================================================================
// DOM ELEMENTS CACHE
// ============================================================================

const DOM = {
  // Forms and cards
  loginForm: document.getElementById('login-form'),
  loginCard: document.getElementById('login-card'),
  resultsCard: document.getElementById('results-card'),
  errorCard: document.getElementById('error-card'),
  loader: document.getElementById('loader'),
  
  // Error handling
  errorMessage: document.getElementById('error-message'),
  tryAgainButton: document.getElementById('try-again'),
  
  // Tables
  hoursTableBody: document.getElementById('hours-table-body'),
  totalFormatted: document.getElementById('total-formatted'),
  
  // Summary cards
  regularWorkdaysElement: document.getElementById('regular-workdays'),
  totalHoursElement: document.getElementById('total-hours'),
  dailyAverageElement: document.getElementById('daily-average'),
  dailyRequiredHoursElement: document.getElementById('daily-required-hours'),
  monthlyRequirementElement: document.getElementById('monthly-requirement'),
  remainingHoursElement: document.getElementById('remaining-hours'),
  completionPercentageElement: document.getElementById('completion-percentage'),
  
  // Buttons
  exportCsvButton: document.getElementById('export-csv'),
  printResultsButton: document.getElementById('print-results'),
  toggleViewButton: document.getElementById('toggle-view'),
  
  // Views
  tableView: document.getElementById('table-view'),
  calendarView: document.getElementById('calendar-view'),
  calendarGrid: document.getElementById('calendar-grid'),
  calendarMonthName: document.getElementById('calendar-month-name'),
  
  // Status cards
  requiredHoursCard: document.getElementById('required-hours-card'),
  remainingHoursCard: document.getElementById('remaining-hours-card'),
  dailyRequiredHoursCard: document.getElementById('daily-required-hours-card'),
  completionCard: document.getElementById('completion-percentage')?.parentElement
};

// ============================================================================
// CONSTANTS
// ============================================================================

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

const HEBREW_DAY_NAMES = {
  'Sunday': 'ראשון',
  'Monday': 'שני',
  'Tuesday': 'שלישי',
  'Wednesday': 'רביעי',
  'Thursday': 'חמישי',
  'Friday': 'שישי',
  'Saturday': 'שבת'
};

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const VIEWS = {
  CALENDAR: 'calendar',
  TABLE: 'table'
};

const DIMENSIONS = {
  ACTION_BTN_HEIGHT: 26,
  CALENDAR_DAY_HEIGHT: 120,
  BADGE_HEIGHT: 22
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let state = {
  workingDayTypes: {},
  allMonthEntries: [],
  currentView: VIEWS.CALENDAR
};

// ============================================================================
// UTILITY FUNCTIONS - DATE & TIME
// ============================================================================

/**
 * Parses a date string in DD/MM/YYYY format
 * @param {string} dateString - Date string to parse
 * @returns {number[]} Array of [day, month, year]
 */
function parseDate(dateString) {
  return dateString.split('/').map(Number);
}

/**
 * Creates a Date object from day, month, year
 * @param {number} day - Day of month
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Date} Date object
 */
function createDateObject(day, month, year) {
  return new Date(year, month - 1, day);
}

/**
 * Checks if a day name represents a weekend
 * @param {string} dayName - Name of the day
 * @returns {boolean} True if weekend
 */
function isWeekend(dayName) {
  return dayName === 'Friday' || dayName === 'Saturday';
}

/**
 * Checks if a day of week number represents a weekend
 * @param {number} dayOfWeek - Day of week (0-6, where 0 is Sunday)
 * @returns {boolean} True if weekend
 */
function isDayOfWeekWeekend(dayOfWeek) {
  return dayOfWeek === 5 || dayOfWeek === 6;
}

/**
 * Validates time format (HH:MM)
 * @param {string} timeString - Time string to validate
 * @returns {boolean} True if valid
 */
function isValidTimeFormat(timeString) {
  return timeString && /^\d+:\d+$/.test(timeString);
}

/**
 * Formats a date as DD/MM/YYYY
 * @param {number} day - Day
 * @param {number} month - Month
 * @param {number} year - Year
 * @returns {string} Formatted date string
 */
function formatDateString(day, month, year) {
  return `${day}/${month}/${year}`;
}

/**
 * Calculates daily average hours
 * @param {number} totalMinutes - Total minutes worked
 * @param {number} days - Number of days
 * @returns {string} Formatted average (H:MM)
 */
function calculateDailyAverage(totalMinutes, days) {
  if (!days || days === 0) return '0:00';
  
  const avgMinutes = Math.round(totalMinutes / days);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;
  
  return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
}

/**
 * Formats hours and minutes in Hebrew
 * @param {number} hours - Number of hours
 * @param {number} minutes - Number of minutes
 * @returns {string} Formatted Hebrew string
 */
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

// ============================================================================
// UI UTILITY FUNCTIONS
// ============================================================================

/**
 * Updates element CSS classes
 * @param {HTMLElement} element - Element to update
 * @param {string[]} classesToRemove - Classes to remove
 * @param {string} classToAdd - Class to add
 */
function updateElementClass(element, classesToRemove, classToAdd) {
  if (!element) return;
  
  if (Array.isArray(classesToRemove)) {
    element.classList.remove(...classesToRemove);
  }
  
  if (classToAdd) {
    element.classList.add(classToAdd);
  }
}

/**
 * Creates a vacation badge element
 * @returns {HTMLElement} Badge element
 */
function createVacationBadge() {
  const badge = document.createElement('span');
  badge.className = 'vacation-badge';
  badge.textContent = 'חופשה';
  badge.style.opacity = '0';
  
  // Smooth transition
  setTimeout(() => {
    badge.style.opacity = '1';
  }, 10);
  
  return badge;
}

/**
 * Creates a holiday badge element
 * @param {string} holidayName - Name of the holiday
 * @returns {HTMLElement} Badge element
 */
function createHolidayBadge(holidayName) {
  const badge = document.createElement('span');
  badge.className = 'vacation-badge holiday-badge';
  badge.textContent = holidayName || 'חג';
  return badge;
}

// ============================================================================
// VIEW MANAGEMENT
// ============================================================================

/**
 * Toggles between calendar and table views
 */
function toggleView() {
  if (state.currentView === VIEWS.TABLE) {
    switchToCalendarView();
  } else {
    switchToTableView();
  }
}

/**
 * Switches to calendar view
 */
function switchToCalendarView() {
  DOM.tableView.classList.add('hidden');
  DOM.calendarView.classList.remove('hidden');
  DOM.toggleViewButton.innerHTML = '<i class="fas fa-table"></i> מעבר לתצוגת טבלה';
  state.currentView = VIEWS.CALENDAR;
  
  if (state.allMonthEntries && state.allMonthEntries.length > 0) {
    generateCalendarView();
  }
}

/**
 * Switches to table view
 */
function switchToTableView() {
  DOM.calendarView.classList.add('hidden');
  DOM.tableView.classList.remove('hidden');
  DOM.toggleViewButton.innerHTML = '<i class="fas fa-calendar-alt"></i> מעבר לתצוגת לוח שנה';
  state.currentView = VIEWS.TABLE;
  
  syncTableView();
}

/**
 * Synchronizes table view with current state
 */
function syncTableView() {
  document.querySelectorAll('.day-type-select').forEach(select => {
    const date = select.dataset.date;
    if (state.workingDayTypes[date]) {
      select.value = state.workingDayTypes[date];
      
      const row = select.closest('tr');
      if (row) {
        row.classList.toggle('vacation-day-row', 
          state.workingDayTypes[date] === DAY_TYPES.VACATION);
      }
    }
  });
}

// ============================================================================
// DATA MANAGEMENT
// ============================================================================

/**
 * Handles day type change (workday/vacation)
 * @param {string} date - Date string
 * @param {string} type - Day type
 */
function handleDayTypeChange(date, type) {
  state.workingDayTypes[date] = type;
  
  // Delay DOM updates to avoid event conflicts
  setTimeout(() => {
    recalculateRequiredHours();
    updateCalendarDayType(date, type);
    updateTableDayType(date, type);
  }, 10);
}

/**
 * Updates calendar day type styling
 * @param {string} date - Date string
 * @param {string} type - Day type
 */
function updateCalendarDayType(date, type) {
  const calendarDay = document.querySelector(`.calendar-day[data-date="${date}"]`);
  if (!calendarDay) return;
  
  const [day, month, year] = parseDate(date);
  const dayDate = createDateObject(day, month, year);
  const dayOfWeek = dayDate.getDay();
  const isWeekendDay = isDayOfWeekWeekend(dayOfWeek);
  
  const existingBadge = calendarDay.querySelector('.vacation-badge:not(.holiday-badge)');
  
  if (type === DAY_TYPES.VACATION) {
    calendarDay.classList.add('vacation-day');
    
    if (!isWeekendDay && !existingBadge) {
      const badge = createVacationBadge();
      calendarDay.insertBefore(badge, calendarDay.firstChild);
    }
  } else {
    calendarDay.classList.remove('vacation-day');
    
    if (existingBadge) {
      existingBadge.remove();
    }
  }
}

/**
 * Updates table day type
 * @param {string} date - Date string
 * @param {string} type - Day type
 */
function updateTableDayType(date, type) {
  const tableSelect = document.querySelector(`.day-type-select[data-date="${date}"]`);
  if (!tableSelect) return;
  
  tableSelect.value = type;
  
  const row = tableSelect.closest('tr');
  if (row) {
    row.classList.toggle('vacation-day-row', type === DAY_TYPES.VACATION);
  }
}

/**
 * Gets count of completed work days
 * @returns {number} Number of completed days
 */
function getCompletedDaysCount() {
  return state.allMonthEntries.filter(entry => 
    !entry.isFutureDay && 
    entry.time && 
    entry.time !== '---' && 
    isValidTimeFormat(entry.time)
  ).length;
}

/**
 * Parses completed hours from UI text
 * @returns {number[]} Array of [hours, minutes]
 */
function parseCompletedHoursFromText() {
  const totalHoursText = DOM.totalHoursElement.textContent;
  let completedHours = 0;
  let completedMinutes = 0;
  
  const completedMatch = totalHoursText.match(/(\d+) שעות(?: ו-?(\d+) דקות)?/);
  if (completedMatch) {
    completedHours = parseInt(completedMatch[1], 10) || 0;
    completedMinutes = parseInt(completedMatch[2], 10) || 0;
  }
  
  return [completedHours, completedMinutes];
}

/**
 * Calculates daily required hours
 * @param {number} remainingRequiredMinutes - Remaining minutes to work
 * @param {number} remainingWorkdaysCount - Remaining workdays
 * @returns {number[]} Array of [hours, minutes]
 */
function calculateDailyRequiredHours(remainingRequiredMinutes, remainingWorkdaysCount) {
  let dailyRequiredHours = 0;
  let dailyRequiredMinutes = 0;
  
  if (remainingWorkdaysCount > 0) {
    const totalDailyRequiredMinutes = Math.round(remainingRequiredMinutes / remainingWorkdaysCount);
    dailyRequiredHours = Math.floor(totalDailyRequiredMinutes / 60);
    dailyRequiredMinutes = totalDailyRequiredMinutes % 60;
  }
  
  return [dailyRequiredHours, dailyRequiredMinutes];
}

/**
 * Updates completion percentage display
 * @param {string} formattedPercentage - Formatted percentage string
 * @param {number} completionPercentage - Numeric percentage
 */
function updateCompletionPercentage(formattedPercentage, completionPercentage) {
  if (!DOM.completionPercentageElement) return;
  
  DOM.completionPercentageElement.textContent = `${formattedPercentage}%`;
  
  if (DOM.completionCard) {
    updateElementClass(
      DOM.completionCard, 
      [STATUS_CLASSES.LOW, STATUS_CLASSES.MID, STATUS_CLASSES.HIGH, STATUS_CLASSES.COMPLETE]
    );
    
    if (completionPercentage < 50) {
      DOM.completionCard.classList.add(STATUS_CLASSES.LOW);
    } else if (completionPercentage < 80) {
      DOM.completionCard.classList.add(STATUS_CLASSES.MID);
    } else if (completionPercentage < 100) {
      DOM.completionCard.classList.add(STATUS_CLASSES.HIGH);
    } else {
      DOM.completionCard.classList.add(STATUS_CLASSES.COMPLETE);
    }
  }
}

/**
 * Updates remaining hours card styling
 * @param {number} remainingRequiredMinutes - Remaining minutes
 */
function updateRemainingHoursCard(remainingRequiredMinutes) {
  if (!DOM.remainingHoursCard) return;
  
  updateElementClass(
    DOM.remainingHoursCard, 
    [STATUS_CLASSES.COMPLETED, STATUS_CLASSES.NEARLY_COMPLETED, STATUS_CLASSES.PENDING]
  );
  
  const hoursRemaining = remainingRequiredMinutes / 60;
  if (hoursRemaining <= 0) {
    DOM.remainingHoursCard.classList.add(STATUS_CLASSES.COMPLETED);
  } else if (hoursRemaining >= 5 && hoursRemaining < 10) {
    DOM.remainingHoursCard.classList.add(STATUS_CLASSES.NEARLY_COMPLETED);
  } else if (hoursRemaining >= 10) {
    DOM.remainingHoursCard.classList.add(STATUS_CLASSES.PENDING);
  }
}

/**
 * Recalculates required hours based on current state
 */
function recalculateRequiredHours() {
  if (!state.allMonthEntries || state.allMonthEntries.length === 0) return;
  
  let totalRequiredMinutes = 0;
  const minutesPerWorkday = 9 * 60;
  const minutesPerThursday = 8.5 * 60;
  let regularWorkdaysCount = 0;
  let remainingWorkdaysCount = 0;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  const completedDays = getCompletedDaysCount();
  
  // Calculate required hours for each day
  state.allMonthEntries.forEach(entry => {
    const dayType = state.workingDayTypes[entry.date] || 
                   (isWeekend(entry.day) || entry.isHoliday ? DAY_TYPES.VACATION : DAY_TYPES.REGULAR);
    
    if (dayType === DAY_TYPES.REGULAR) {
      const [day, month, year] = parseDate(entry.date);
      const entryDate = createDateObject(day, month, year);
      const dayOfWeek = entryDate.getDay();
      
      regularWorkdaysCount++;
      
      if (entryDate >= currentDate) {
        remainingWorkdaysCount++;
      }
      
      if (dayOfWeek === 4) { // Thursday
        totalRequiredMinutes += minutesPerThursday;
      } else {
        totalRequiredMinutes += minutesPerWorkday;
      }
    }
  });
  
  // Update workdays count
  DOM.regularWorkdaysElement.textContent = `${regularWorkdaysCount} / ${completedDays}`;
  
  // Calculate hours and minutes
  const totalRequiredHours = Math.floor(totalRequiredMinutes / 60);
  const totalRequiredRemainingMinutes = totalRequiredMinutes % 60;
  
  const [completedHours, completedMinutes] = parseCompletedHoursFromText();
  const totalCompletedMinutes = (completedHours * 60) + completedMinutes;
  
  const remainingRequiredMinutes = Math.max(0, totalRequiredMinutes - totalCompletedMinutes);
  const remainingHours = Math.floor(remainingRequiredMinutes / 60);
  const remainingMinutes = remainingRequiredMinutes % 60;
  
  const [dailyRequiredHours, dailyRequiredMinutes] = calculateDailyRequiredHours(
    remainingRequiredMinutes, 
    remainingWorkdaysCount
  );
  
  // Calculate completion percentage
  const safeRequiredMinutes = Math.max(1, totalRequiredMinutes);
  const completionPercentage = (totalCompletedMinutes / safeRequiredMinutes) * 100;
  const formattedPercentage = completionPercentage.toFixed(1);
  
  // Update UI
  DOM.monthlyRequirementElement.textContent = `${totalRequiredHours} שעות ${totalRequiredRemainingMinutes > 0 ? `${totalRequiredRemainingMinutes} דקות` : ''}`;
  DOM.remainingHoursElement.textContent = `${remainingHours} שעות ${remainingMinutes > 0 ? `${remainingMinutes} דקות` : ''}`;
  
  const formattedDailyMinutes = dailyRequiredMinutes < 10 ? `0${dailyRequiredMinutes}` : dailyRequiredMinutes;
  DOM.dailyRequiredHoursElement.textContent = `${dailyRequiredHours}:${formattedDailyMinutes}`;
  
  updateCompletionPercentage(formattedPercentage, completionPercentage);
  updateRemainingHoursCard(remainingRequiredMinutes);
}

/**
 * Initializes day types for all month entries
 */
function initializeDayTypes() {
  state.allMonthEntries.forEach(entry => {
    if (!state.workingDayTypes[entry.date]) {
      if (isWeekend(entry.day) || entry.isHoliday) {
        state.workingDayTypes[entry.date] = DAY_TYPES.VACATION;
      } else {
        state.workingDayTypes[entry.date] = DAY_TYPES.REGULAR;
      }
    }
  });
}

/**
 * Counts regular workdays
 * @returns {number} Count of regular workdays
 */
function countRegularWorkdays() {
  let count = 0;
  state.allMonthEntries.forEach(entry => {
    if (!isWeekend(entry.day) && !entry.isHoliday && !entry.holidayName && 
        state.workingDayTypes[entry.date] === DAY_TYPES.REGULAR) {
      count++;
    }
  });
  return count;
}

// ============================================================================
// CALENDAR VIEW GENERATION
// ============================================================================

/**
 * Adds action buttons to calendar day
 * @param {HTMLElement} dayCell - Day cell element
 * @param {string} dateString - Date string
 */
function addDayActionButtons(dayCell, dateString) {
  const dayActions = document.createElement('div');
  dayActions.className = 'day-actions';
  
  const vacationBtn = document.createElement('button');
  vacationBtn.className = 'action-btn vacation-btn';
  vacationBtn.innerHTML = '<i class="fas fa-umbrella-beach"></i> סמן כחופשה';
  vacationBtn.setAttribute('data-date', dateString);
  vacationBtn.addEventListener('click', () => {
    handleDayTypeChange(dateString, DAY_TYPES.VACATION);
  });
  
  const workdayBtn = document.createElement('button');
  workdayBtn.className = 'action-btn workday-btn';
  workdayBtn.innerHTML = '<i class="fas fa-briefcase"></i> סמן כיום עבודה';
  workdayBtn.setAttribute('data-date', dateString);
  workdayBtn.addEventListener('click', () => {
    handleDayTypeChange(dateString, DAY_TYPES.REGULAR);
  });
  
  dayActions.appendChild(vacationBtn);
  dayActions.appendChild(workdayBtn);
  dayCell.appendChild(dayActions);
}

/**
 * Creates a calendar day cell
 * @param {number} dayOfMonth - Day of the month
 * @param {number} month - Month
 * @param {number} year - Year
 * @param {Object} entriesByDay - Map of entries by day
 * @param {Date} currentDate - Current date
 */
function createCalendarDay(dayOfMonth, month, year, entriesByDay, currentDate) {
  const dayCell = document.createElement('div');
  const dayDate = createDateObject(dayOfMonth, month, year);
  const dayOfWeek = dayDate.getDay();
  const isWeekendDay = isDayOfWeekWeekend(dayOfWeek);
  const isFutureDay = dayDate > currentDate;
  const isPastDay = dayDate < currentDate;
  const isCurrentDay = dayDate.toDateString() === currentDate.toDateString();
  const dateString = formatDateString(dayOfMonth, month, year);
  
  // Build CSS classes
  let dayClasses = 'calendar-day';
  if (isWeekendDay) dayClasses += ' weekend';
  if (isFutureDay) dayClasses += ' future-day';
  if (isPastDay) dayClasses += ' past-day';
  if (isCurrentDay) dayClasses += ' current-day';
  
  dayCell.className = dayClasses;
  dayCell.setAttribute('data-date', dateString);
  
  const entry = entriesByDay[dayOfMonth];
  const isHoliday = entry && entry.isHoliday;
  const holidayName = entry && entry.holidayName;
  
  // Determine day type
  const dayType = state.workingDayTypes[dateString] || 
                (isWeekendDay || isHoliday ? DAY_TYPES.VACATION : DAY_TYPES.REGULAR);
  
  state.workingDayTypes[dateString] = dayType;
  
  if (dayType === DAY_TYPES.VACATION) {
    dayCell.classList.add('vacation-day');
  }
  
  // Add day number
  const dayNumber = document.createElement('div');
  dayNumber.className = 'day-number';
  dayNumber.textContent = dayOfMonth;
  dayCell.appendChild(dayNumber);
  
  // Add badges
  if (holidayName) {
    dayCell.appendChild(createHolidayBadge(holidayName));
  } else if (dayType === DAY_TYPES.VACATION && !isWeekendDay) {
    dayCell.appendChild(createVacationBadge());
  }
  
  // Add work hours
  if (entry && entry.time && isValidTimeFormat(entry.time)) {
    const dayHours = document.createElement('div');
    dayHours.className = 'day-hours';
    dayHours.textContent = entry.time;
    dayCell.appendChild(dayHours);
  }
  
  // Add holiday name if not already shown in badge
  if (entry && entry.holidayName && !dayCell.querySelector('.holiday-badge')) {
    const holidayNameEl = document.createElement('div');
    holidayNameEl.className = 'holiday-name';
    holidayNameEl.textContent = entry.holidayName;
    dayCell.appendChild(holidayNameEl);
  }
  
  // Add spacer
  const spacer = document.createElement('div');
  spacer.style.flexGrow = '1';
  dayCell.appendChild(spacer);
  
  // Add action buttons for non-weekend days
  if (!isWeekendDay) {
    addDayActionButtons(dayCell, dateString);
  }
  
  DOM.calendarGrid.appendChild(dayCell);
}

/**
 * Generates the calendar view
 */
function generateCalendarView() {
  DOM.calendarGrid.innerHTML = '';
  
  if (!state.allMonthEntries || state.allMonthEntries.length === 0) return;
  
  const [day, month, year] = parseDate(state.allMonthEntries[0].date);
  
  DOM.calendarMonthName.textContent = `${HEBREW_MONTHS[month-1]} ${year}`;
  
  const firstDayOfMonth = createDateObject(1, month, year);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  // Create entries map
  const entriesByDay = {};
  state.allMonthEntries.forEach(entry => {
    const [entryDay] = parseDate(entry.date);
    entriesByDay[entryDay] = entry;
  });
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    DOM.calendarGrid.appendChild(emptyCell);
  }
  
  // Add cells for each day of the month
  for (let dayOfMonth = 1; dayOfMonth <= lastDayOfMonth; dayOfMonth++) {
    createCalendarDay(dayOfMonth, month, year, entriesByDay, currentDate);
  }
}

// ============================================================================
// TABLE VIEW GENERATION
// ============================================================================

/**
 * Creates a table row for an entry
 * @param {Object} entry - Time entry object
 * @param {Date} currentDate - Current date
 */
function createTableRow(entry, currentDate) {
  const row = document.createElement('tr');
  
  const weekendClass = isWeekend(entry.day) ? 'weekend-day' : '';
  const isEntryWeekend = isWeekend(entry.day);
  
  const [day, month, year] = parseDate(entry.date);
  const entryDate = createDateObject(day, month, year);
  const isFutureDay = entryDate > currentDate;
  const isPastDay = entryDate < currentDate;
  
  // Format time
  let hebrewHoursMinutes = '---';
  if (isValidTimeFormat(entry.time)) {
    const [hours, minutes] = entry.time.split(':').map(Number);
    hebrewHoursMinutes = formatHoursMinutes(hours, minutes);
  }
  
  const hebrewDate = `${day}/${month}/${year}`;
  const hebrewDay = HEBREW_DAY_NAMES[entry.day] || entry.day;
  
  // Build day type selector
  let dayTypeHTML = '';
  if (isEntryWeekend) {
    state.workingDayTypes[entry.date] = DAY_TYPES.VACATION;
  } else {
    dayTypeHTML = `
      <select class="day-type-select" data-date="${entry.date}">
        <option value="${DAY_TYPES.REGULAR}" ${state.workingDayTypes[entry.date] === DAY_TYPES.REGULAR ? 'selected' : ''}>${DAY_TYPES.REGULAR}</option>
        <option value="${DAY_TYPES.VACATION}" ${state.workingDayTypes[entry.date] === DAY_TYPES.VACATION ? 'selected' : ''}>${DAY_TYPES.VACATION}</option>
      </select>
    `;
  }
  
  // Build row classes
  let rowClasses = [];
  if (isFutureDay) rowClasses.push('future-day');
  if (isPastDay) rowClasses.push('past-day-row');
  if (entryDate.toDateString() === currentDate.toDateString()) rowClasses.push('current-day-row');
  if (state.workingDayTypes[entry.date] === DAY_TYPES.VACATION || entry.isHoliday || entry.holidayName) {
    rowClasses.push('vacation-day-row');
  }
  
  row.className = rowClasses.join(' ');
  row.innerHTML = `
    <td>${hebrewDate}</td>
    <td class="${weekendClass}">${hebrewDay}</td>
    <td>${hebrewHoursMinutes}</td>
    <td>${entry.holidayName || '---'}</td>
    <td>${dayTypeHTML}</td>
  `;
  
  DOM.hoursTableBody.appendChild(row);
}

/**
 * Displays all table rows
 */
function displayTableRows() {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  state.allMonthEntries.forEach(entry => {
    createTableRow(entry, currentDate);
  });
  
  addDayTypeSelectListeners();
}

/**
 * Adds event listeners to day type selectors
 */
function addDayTypeSelectListeners() {
  document.querySelectorAll('.day-type-select').forEach(select => {
    select.addEventListener('change', function() {
      const date = this.dataset.date;
      const type = this.value;
      handleDayTypeChange(date, type);
    });
  });
}

// ============================================================================
// DATA DISPLAY
// ============================================================================

/**
 * Updates summary information
 * @param {Object} result - Calculation result
 */
function updateSummaryInfo(result) {
  const completedDays = getCompletedDaysCount();
  const regularWorkdaysCount = countRegularWorkdays();
  
  DOM.regularWorkdaysElement.textContent = `${regularWorkdaysCount} / ${completedDays}`;
  
  const hebrewFormatted = formatHoursMinutes(result.totalHours, result.remainingMinutes);
  DOM.totalFormatted.textContent = hebrewFormatted;
  DOM.totalHoursElement.textContent = hebrewFormatted;
  
  DOM.dailyAverageElement.textContent = calculateDailyAverage(result.totalMinutes, completedDays);
  
  if (result.monthlyRequirement) {
    DOM.monthlyRequirementElement.textContent = result.monthlyRequirement.totalRequiredFormatted;
    DOM.remainingHoursElement.textContent = result.monthlyRequirement.remainingFormatted;
  }
  
  recalculateRequiredHours();
}

/**
 * Displays work hours data
 * @param {Object} result - Work hours calculation result
 */
function displayWorkHours(result) {
  DOM.hoursTableBody.innerHTML = '';
  
  state.allMonthEntries = result.entries;
  
  initializeDayTypes();
  displayTableRows();
  updateSummaryInfo(result);
  
  if (state.currentView === VIEWS.CALENDAR) {
    generateCalendarView();
  }
}

// ============================================================================
// EXPORT & PRINT
// ============================================================================

/**
 * Exports data to CSV file
 */
function exportToCsv() {
  let csvContent = "תאריך,יום,שעות,חג,סוג\n";
  
  Array.from(DOM.hoursTableBody.querySelectorAll('tr')).forEach(row => {
    const cells = row.querySelectorAll('td');
    const dayTypeSelect = row.querySelector('.day-type-select');
    const dayType = dayTypeSelect ? dayTypeSelect.value : DAY_TYPES.REGULAR;
    
    const rowData = [
      `"${cells[0].textContent}"`,
      `"${cells[1].textContent}"`,
      `"${cells[2].textContent}"`,
      `"${cells[3].textContent}"`,
      `"${dayType}"`
    ];
    
    csvContent += rowData.join(',') + "\n";
  });
  
  csvContent += `"סה״כ",,"${DOM.totalFormatted.textContent}",""\n`;
  
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

/**
 * Prints the results
 */
function printResults() {
  window.print();
}

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

/**
 * Shows loading state
 */
function showLoading() {
  DOM.loginCard.classList.add('hidden');
  DOM.resultsCard.classList.add('hidden');
  DOM.errorCard.classList.add('hidden');
  DOM.loader.classList.remove('hidden');
}

/**
 * Shows error state
 * @param {string} message - Error message
 */
function showError(message) {
  DOM.loginCard.classList.add('hidden');
  DOM.resultsCard.classList.add('hidden');
  DOM.loader.classList.add('hidden');
  
  // Localize common error messages
  if (message.includes('Login failed')) {
    message = 'ההתחברות נכשלה. אנא בדוק את פרטי ההתחברות שלך.';
  } else if (message.includes('No time entries found')) {
    message = 'לא נמצאו רשומות זמן בחודש הנוכחי.';
  } else if (message.includes('Failed to fetch')) {
    message = 'אין חיבור לשרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.';
  }
  
  DOM.errorMessage.textContent = message;
  DOM.errorCard.classList.remove('hidden');
}

/**
 * Shows results state
 */
function showResults() {
  DOM.loginCard.classList.add('hidden');
  DOM.errorCard.classList.add('hidden');
  DOM.loader.classList.add('hidden');
  DOM.resultsCard.classList.remove('hidden');
  
  // Default to calendar view
  DOM.tableView.classList.add('hidden');
  DOM.calendarView.classList.remove('hidden');
  DOM.toggleViewButton.innerHTML = '<i class="fas fa-table"></i> מעבר לתצוגת טבלה';
  state.currentView = VIEWS.CALENDAR;
  
  if (state.allMonthEntries && state.allMonthEntries.length > 0) {
    generateCalendarView();
  }
}

/**
 * Resets to login form
 */
function resetForm() {
  DOM.errorCard.classList.add('hidden');
  DOM.resultsCard.classList.add('hidden');
  DOM.loader.classList.add('hidden');
  DOM.loginCard.classList.remove('hidden');
}

// ============================================================================
// API COMMUNICATION
// ============================================================================

/**
 * Fetches Hilan data from server
 * @param {Object} credentials - Login credentials
 */
async function fetchHilanData(credentials) {
  try {
    showLoading();
    
    credentials.isEn = false;
    
    const response = await fetch('/api/hilan-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'נכשל לקבל נתונים מחילן');
    }
    
    displayWorkHours(data.data);
    showResults();
    
  } catch (error) {
    console.error('Error:', error);
    showError(error.message || 'אירעה שגיאה לא ידועה');
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Initializes all event listeners
 */
function initEventListeners() {
  // Login form submission
  DOM.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    
    const credentials = {
      orgId: document.getElementById('orgId').value,
      username: document.getElementById('username').value,
      password: document.getElementById('password').value,
      isEn: false
    };
    
    fetchHilanData(credentials);
  });
  
  // Button clicks
  DOM.tryAgainButton.addEventListener('click', resetForm);
  DOM.exportCsvButton.addEventListener('click', exportToCsv);
  DOM.printResultsButton.addEventListener('click', printResults);
  DOM.toggleViewButton.addEventListener('click', toggleView);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

initEventListeners();

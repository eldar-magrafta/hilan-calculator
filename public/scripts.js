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
  dailyRequiredHoursCard: document.getElementById('daily-required-hours-card')
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

// Date and time helper functions
function parseDate(dateString) {
  return dateString.split('/').map(Number);
}

function createDateObject(day, month, year) {
  return new Date(year, month - 1, day);
}

function isWeekend(dayName) {
  return dayName === 'Friday' || dayName === 'Saturday';
}

function isDayOfWeekWeekend(dayOfWeek) {
  return dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
}

function isValidTimeFormat(timeString) {
  return timeString && timeString.match(/^\d+:\d+$/);
}

function formatDateString(day, month, year) {
  return `${day}/${month}/${year}`;
}

function getCategoryForDay(date, dayName, isHoliday, holidayName) {
  // If explicitly set as vacation, return vacation
  if (workingDayTypes[date] === DAY_TYPES.VACATION) {
    return DAY_TYPES.VACATION;
  }
  
  // If it's a weekend or holiday, return vacation
  if (isWeekend(dayName) || isHoliday || holidayName) {
    return DAY_TYPES.VACATION;
  }
  
  // Otherwise, return regular workday
  return DAY_TYPES.REGULAR;
}

// UI Helper functions
function createVacationBadge() {
  const badge = document.createElement('span');
  badge.className = 'vacation-badge';
  badge.textContent = 'חופשה';
  return badge;
}

function createHolidayBadge(holidayName) {
  const badge = document.createElement('span');
  badge.className = 'vacation-badge holiday-badge';
  badge.textContent = holidayName || 'חג';
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

// Time calculations
function calculateDailyAverage(totalMinutes, days) {
  if (!days || days === 0) return '0:00';
  
  const avgMinutes = Math.round(totalMinutes / days);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;
  
  return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
}

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

// View switching logic
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

// Table view synchronization
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

// Day type change handling
function handleDayTypeChange(date, type) {
  // Update the global working day types object
  workingDayTypes[date] = type;
  
  // Recalculate the required hours
  recalculateRequiredHours();
  
  // Update views
  updateCalendarDayType(date, type);
  updateTableDayType(date, type);
}

// Update calendar day appearance for day type changes
function updateCalendarDayType(date, type) {
  const calendarDay = document.querySelector(`.calendar-day[data-date="${date}"]`);
  if (!calendarDay) return;
  
  // Check if it's a weekend day
  const [day, month, year] = parseDate(date);
  const dayDate = createDateObject(day, month, year);
  const dayOfWeek = dayDate.getDay();
  const isWeekendDay = isDayOfWeekWeekend(dayOfWeek);
  
  // Update the class
  if (type === DAY_TYPES.VACATION) {
    calendarDay.classList.add('vacation-day');
    
    // Only add vacation badge for non-weekend days
    if (!isWeekendDay && !calendarDay.querySelector('.vacation-badge')) {
      calendarDay.insertBefore(createVacationBadge(), calendarDay.firstChild);
    }
  } else {
    calendarDay.classList.remove('vacation-day');
    
    // Always remove the badge if changing back to regular workday
    const badge = calendarDay.querySelector('.vacation-badge:not(.holiday-badge)');
    if (badge) {
      calendarDay.removeChild(badge);
    }
  }
}

// Update table row for day type changes
function updateTableDayType(date, type) {
  const tableSelect = document.querySelector(`.day-type-select[data-date="${date}"]`);
  if (!tableSelect) return;
  
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

// Requirements calculation
function recalculateRequiredHours() {
  if (!allMonthEntries || allMonthEntries.length === 0) return;
  
  let totalRequiredMinutes = 0;
  const minutesPerWorkday = 9 * 60;
  const minutesPerThursday = 8.5 * 60;  // Less hours on Thursday
  let regularWorkdaysCount = 0;
  let remainingWorkdaysCount = 0;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  // Count completed days for the ratio display
  const completedDays = getCompletedDaysCount();
  
  allMonthEntries.forEach(entry => {
    const dayType = workingDayTypes[entry.date] || 
                   (isWeekend(entry.day) || entry.isHoliday ? DAY_TYPES.VACATION : DAY_TYPES.REGULAR);
    
    if (dayType === DAY_TYPES.REGULAR) {
      const [day, month, year] = parseDate(entry.date);
      const entryDate = createDateObject(day, month, year);
      const dayOfWeek = entryDate.getDay();
      
      regularWorkdaysCount++;
      
      // Count remaining work days (today and future days)
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
  
  // Update regular workdays with the ratio format: regular / completed
  elements.regularWorkdaysElement.textContent = regularWorkdaysCount + " / " + completedDays;
  
  // Calculate total hours
  const totalRequiredHours = Math.floor(totalRequiredMinutes / 60);
  const totalRequiredRemainingMinutes = totalRequiredMinutes % 60;
  
  // Parse completed hours from the displayed text
  const [completedHours, completedMinutes] = parseCompletedHoursFromText();
  const totalCompletedMinutes = (completedHours * 60) + completedMinutes;
  
  // Calculate remaining required minutes
  const remainingRequiredMinutes = Math.max(0, totalRequiredMinutes - totalCompletedMinutes);
  const remainingHours = Math.floor(remainingRequiredMinutes / 60);
  const remainingMinutes = remainingRequiredMinutes % 60;
  
  // Calculate daily required hours
  const [dailyRequiredHours, dailyRequiredMinutes] = calculateDailyRequiredHours(remainingRequiredMinutes, remainingWorkdaysCount);
  
  // Calculate completion percentage
  const safeRequiredMinutes = Math.max(1, totalRequiredMinutes);
  const completionPercentage = (totalCompletedMinutes / safeRequiredMinutes) * 100;
  const formattedPercentage = completionPercentage.toFixed(1);
  
  // Update UI elements
  elements.monthlyRequirementElement.textContent = `${totalRequiredHours} שעות ${totalRequiredRemainingMinutes > 0 ? `${totalRequiredRemainingMinutes} דקות` : ''}`;
  elements.remainingHoursElement.textContent = `${remainingHours} שעות ${remainingMinutes > 0 ? `${remainingMinutes} דקות` : ''}`;
  
  // Format daily required hours in X:Y format
  const formattedDailyMinutes = dailyRequiredMinutes < 10 ? `0${dailyRequiredMinutes}` : dailyRequiredMinutes;
  elements.dailyRequiredHoursElement.textContent = `${dailyRequiredHours}:${formattedDailyMinutes}`;
  
  // Update completion percentage
  updateCompletionPercentage(formattedPercentage, completionPercentage);
  
  // Update remaining hours card
  updateRemainingHoursCard(remainingRequiredMinutes);
}

function getCompletedDaysCount() {
  return allMonthEntries.filter(entry => 
    !entry.isFutureDay && 
    entry.time && 
    entry.time !== '---' && 
    isValidTimeFormat(entry.time)
  ).length;
}

function parseCompletedHoursFromText() {
  const totalHoursText = elements.totalHoursElement.textContent;
  let completedHours = 0;
  let completedMinutes = 0;
  
  const completedMatch = totalHoursText.match(/(\d+) שעות(?: ו-?(\d+) דקות)?/);
  if (completedMatch) {
    completedHours = parseInt(completedMatch[1], 10) || 0;
    completedMinutes = parseInt(completedMatch[2], 10) || 0;
  }
  
  return [completedHours, completedMinutes];
}

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

function updateCompletionPercentage(formattedPercentage, completionPercentage) {
  if (!elements.completionPercentageElement) return;
  
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

function updateRemainingHoursCard(remainingRequiredMinutes) {
  if (!elements.remainingHoursCard) return;
  
  updateElementClass(
    elements.remainingHoursCard, 
    [STATUS_CLASSES.COMPLETED, STATUS_CLASSES.NEARLY_COMPLETED, STATUS_CLASSES.PENDING]
  );
  
  const hoursRemaining = remainingRequiredMinutes / 60;
  if (hoursRemaining <= 0) {
    elements.remainingHoursCard.classList.add(STATUS_CLASSES.COMPLETED);
  } else if (hoursRemaining >= 5 && hoursRemaining < 10) {
    elements.remainingHoursCard.classList.add(STATUS_CLASSES.NEARLY_COMPLETED);
  } else if (hoursRemaining >= 10) {
    elements.remainingHoursCard.classList.add(STATUS_CLASSES.PENDING);
  }
}

// Calendar view generation
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
    createCalendarDay(dayOfMonth, month, year, entriesByDay, currentDate);
  }
}

function createCalendarDay(dayOfMonth, month, year, entriesByDay, currentDate) {
  const dayCell = document.createElement('div');
  const dayDate = createDateObject(dayOfMonth, month, year);
  const dayOfWeek = dayDate.getDay();
  const isWeekendDay = isDayOfWeekWeekend(dayOfWeek);
  const isFutureDay = dayDate > currentDate;
  const isPastDay = dayDate < currentDate;
  const isCurrentDay = dayDate.toDateString() === currentDate.toDateString();
  const dateString = formatDateString(dayOfMonth, month, year);
  
  // Build class list based on day properties
  let dayClasses = 'calendar-day';
  if (isWeekendDay) dayClasses += ' weekend';
  if (isFutureDay) dayClasses += ' future-day';
  if (isPastDay) dayClasses += ' past-day';
  if (isCurrentDay) dayClasses += ' current-day';
  
  dayCell.className = dayClasses;
  dayCell.setAttribute('data-date', dateString);
  
  const entry = entriesByDay[dayOfMonth];
  
  // Check for holiday
  const isHoliday = entry && entry.isHoliday;
  const holidayName = entry && entry.holidayName;
  
  // Determine day type based on various factors
  const dayType = workingDayTypes[dateString] || 
                (isWeekendDay || isHoliday ? DAY_TYPES.VACATION : DAY_TYPES.REGULAR);
  
  // Store the day type
  workingDayTypes[dateString] = dayType;
  
  // Add vacation-day class if it's marked as a vacation day
  if (dayType === DAY_TYPES.VACATION) {
    dayCell.classList.add('vacation-day');
  }
  
  // Add day number
  const dayNumber = document.createElement('div');
  dayNumber.className = 'day-number';
  dayNumber.textContent = dayOfMonth;
  dayCell.appendChild(dayNumber);
  
  // Add holiday badge if applicable
  if (holidayName) {
    dayCell.appendChild(createHolidayBadge(holidayName));
  }
  // Add vacation badge ONLY to non-weekend vacation days with no holiday name
  else if (dayType === DAY_TYPES.VACATION && !isWeekendDay && !holidayName) {
    dayCell.appendChild(createVacationBadge());
  }
  
  // Add hours if present
  if (entry && entry.time && isValidTimeFormat(entry.time)) {
    const dayHours = document.createElement('div');
    dayHours.className = 'day-hours';
    dayHours.textContent = entry.time;
    dayCell.appendChild(dayHours);
  }
  
  // Add holiday name if present and not already added as a badge
  if (entry && entry.holidayName && !dayCell.querySelector('.holiday-badge')) {
    const holidayNameEl = document.createElement('div');
    holidayNameEl.className = 'holiday-name';
    holidayNameEl.textContent = entry.holidayName;
    dayCell.appendChild(holidayNameEl);
  }
  
  // Add a spacer div to push content apart
  const spacer = document.createElement('div');
  spacer.style.flexGrow = '1';
  dayCell.appendChild(spacer);
  
  // Add action buttons for non-weekend days, including holidays
  if (!isWeekendDay) {
    addDayActionButtons(dayCell, dateString);
  }
  
  elements.calendarGrid.appendChild(dayCell);
}

function addDayActionButtons(dayCell, dateString) {
  const dayActions = document.createElement('div');
  dayActions.className = 'day-actions';
  
  // Get the current day type
  const currentDayType = workingDayTypes[dateString];
  
  // Vacation button - show only for regular workdays
  const vacationBtn = document.createElement('button');
  vacationBtn.className = 'action-btn vacation-btn';
  vacationBtn.innerHTML = '<i class="fas fa-umbrella-beach"></i> חופשה';
  vacationBtn.setAttribute('data-date', dateString);
  vacationBtn.addEventListener('click', function() {
    handleDayTypeChange(dateString, DAY_TYPES.VACATION);
  });
  
  // Workday button - show only for vacation days
  const workdayBtn = document.createElement('button');
  workdayBtn.className = 'action-btn workday-btn';
  workdayBtn.innerHTML = '<i class="fas fa-briefcase"></i> יום עבודה';
  workdayBtn.setAttribute('data-date', dateString);
  workdayBtn.addEventListener('click', function() {
    handleDayTypeChange(dateString, DAY_TYPES.REGULAR);
  });
  
  dayActions.appendChild(vacationBtn);
  dayActions.appendChild(workdayBtn);
  dayCell.appendChild(dayActions);
}

// Display work hours in table and calendar views
function displayWorkHours(result) {
  elements.hoursTableBody.innerHTML = '';
  
  allMonthEntries = result.entries;
  
  // Initialize day types
  initializeDayTypes();
  
  // Display table rows
  displayTableRows();
  
  // Update summary information
  updateSummaryInfo(result);
  
  // Generate calendar if that's the current view
  if (currentView === 'calendar') {
    generateCalendarView();
  }
}

function initializeDayTypes() {
  allMonthEntries.forEach(entry => {
    if (!workingDayTypes[entry.date]) {
      if (isWeekend(entry.day) || entry.isHoliday) {
        workingDayTypes[entry.date] = DAY_TYPES.VACATION;
      } else {
        workingDayTypes[entry.date] = DAY_TYPES.REGULAR;
      }
    }
  });
}

function displayTableRows() {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  allMonthEntries.forEach(entry => {
    createTableRow(entry, currentDate);
  });
  
  // Add event listeners to day type selects
  addDayTypeSelectListeners();
}

function createTableRow(entry, currentDate) {
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
    // Regular dropdown for non-weekend days, including holidays
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
}

function addDayTypeSelectListeners() {
  document.querySelectorAll('.day-type-select').forEach(select => {
    select.addEventListener('change', function() {
      const date = this.dataset.date;
      const type = this.value;
      
      handleDayTypeChange(date, type);
    });
  });
}

function updateSummaryInfo(result) {
  // Calculate completed days
  const completedDays = getCompletedDaysCount();
  
  // Count regular workdays
  const regularWorkdaysCount = countRegularWorkdays();
  
  // Update regular workdays ratio
  elements.regularWorkdaysElement.textContent = regularWorkdaysCount + " / " + completedDays;
  
  // Update total hours
  const hebrewFormatted = formatHoursMinutes(result.totalHours, result.remainingMinutes);
  elements.totalFormatted.textContent = hebrewFormatted;
  elements.totalHoursElement.textContent = hebrewFormatted;
  
  // Update daily average
  elements.dailyAverageElement.textContent = calculateDailyAverage(result.totalMinutes, completedDays);
  
  // Update monthly requirement if available
  if (result.monthlyRequirement) {
    elements.monthlyRequirementElement.textContent = result.monthlyRequirement.totalRequiredFormatted;
    elements.remainingHoursElement.textContent = result.monthlyRequirement.remainingFormatted;
  }
  
  // Recalculate required hours
  recalculateRequiredHours();
}

function countRegularWorkdays() {
  let count = 0;
  allMonthEntries.forEach(entry => {
    if (!isWeekend(entry.day) && !entry.isHoliday && !entry.holidayName && 
        workingDayTypes[entry.date] === DAY_TYPES.REGULAR) {
      count++;
    }
  });
  return count;
}

// CSV Export function
function exportToCsv() {
  // Create CSV content with Hebrew headers
  let csvContent = "תאריך,יום,שעות,חג,סוג\n";
  
  // Add table rows
  Array.from(elements.hoursTableBody.querySelectorAll('tr')).forEach(row => {
    const cells = row.querySelectorAll('td');
    const dayTypeSelect = row.querySelector('.day-type-select');
    const dayType = dayTypeSelect ? dayTypeSelect.value : DAY_TYPES.REGULAR;
    
    // Create an array of cell values
    const rowData = [
      `"${cells[0].textContent}"`, // Date
      `"${cells[1].textContent}"`, // Day
      `"${cells[2].textContent}"`, // Hours
      `"${cells[3].textContent}"`, // Holiday
      `"${dayType}"`               // Type
    ];
    
    csvContent += rowData.join(',') + "\n";
  });
  
  // Add total row
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

// Function to print results
function printResults() {
  window.print();
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
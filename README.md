# מחשבון שעות חילן (Hilan Hours Calculator)

A modern web application that helps Israeli employees track and calculate their work hours from the Hilan attendance system.

## 🚀 Features

- **Secure Login**: Connect directly to Hilan servers with your organization credentials
- **Real-time Data**: Fetch current month attendance data automatically
- **Smart Calculations**: 
  - Total hours worked this month
  - Required hours based on workdays
  - Remaining hours needed
  - Daily average and daily targets
- **Flexible Views**: 
  - Calendar view for visual overview
  - Table view for detailed data
- **Work Day Management**: Mark days as vacation or work days
- **Missing Reports Detection**: Highlights days with missing time reports
- **Export Options**: Export data to CSV or print reports
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Hebrew Interface**: Full RTL support with Hebrew text

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Express

## 🚀 Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hilan-calculator.git
   cd hilan-calculator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Or start the production server**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 📖 How to Use

1. **Login**: Enter your Hilan organization ID, employee number, and password
2. **View Data**: The app will automatically fetch and display your current month's attendance
3. **Switch Views**: Toggle between calendar and table views using the view toggle button
4. **Manage Work Days**: 
   - Mark days as vacation or work days using the action buttons
   - The system automatically calculates required hours based on your settings
5. **Export Data**: Use the export button to download your data as CSV
6. **Print Reports**: Use the print button for physical reports

## 🔒 Security & Privacy

- **No Data Storage**: Your login credentials are never stored on our servers
- **Direct Communication**: All data requests go directly to Hilan servers
- **Session-based**: Uses temporary session cookies that expire after use
- **HTTPS Only**: All communications are encrypted

## ⚙️ Configuration

The application comes pre-configured with:
- Default organization ID: 3023 (Motorola)
- Work hours: 9 hours/day (8.5 hours on Thursdays)
- Hebrew interface with RTL support

You can modify these settings in the `server.js` file:

```javascript
const MINUTES_PER_WORKDAY = 9 * 60;
const MINUTES_PER_THURSDAY = 8.5 * 60;
```

## 📂 Project Structure

```
hilan-calculator/
├── public/
│   ├── index.html          # Main HTML file
│   ├── scripts.js          # Frontend JavaScript
│   ├── styles.css          # CSS styling
│   └── assets/             # Images and icons
├── server.js               # Express server
├── package.json            # Project dependencies
└── README.md              # This file
```

## 📝 API Endpoints

### POST `/api/hilan-data`
Fetches attendance data from Hilan servers.

**Request Body:**
```json
{
  "orgId": "3023",
  "username": "your-employee-id",
  "password": "your-password",
  "isEn": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [...],
    "totalHours": 120,
    "totalMinutes": 7200,
    "monthlyRequirement": {...}
  }
}
```
## 👨‍💻 Author

**Eldar M** - *Developer*
---

**Note**: This application is not affiliated with Hilan or any specific organization. It's a third-party tool designed to help employees better understand their attendance data.

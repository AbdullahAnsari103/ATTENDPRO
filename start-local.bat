@echo off
echo Starting AttendPro Development Server...
echo.
echo Setting up environment...
copy .env.local .env 2>nul
echo Environment configured!
echo.
echo Starting server on http://localhost:3000
echo Admin Panel: http://localhost:3000/admin-panel9920867077@AdilAbullahaUroojFatir
echo Student Portal: http://localhost:3000/student-portal
echo.
npm run dev
pause
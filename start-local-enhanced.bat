@echo off
echo 🚀 AttendPro Local Development Server
echo ====================================
echo.

echo 📋 Checking setup...
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo 🗄️ Setting up database...
node test-db.js &
timeout /t 3 /nobreak > nul

echo 🔧 Configuring environment...
copy .env.local .env 2>nul
echo Environment configured!

echo.
echo 🌐 Server URLs:
echo • Main App: http://localhost:3000
echo • Admin Panel: http://localhost:3000/admin-panel9920867077@AdilAbullahaUroojFatir
echo • Student Portal: http://localhost:3000/student-portal
echo • Health Check: http://localhost:3000/health
echo.

echo 🔑 Emergency Admin Login:
echo • Username: admin
echo • Password: AttendPro2024!
echo.

echo ⚡ Starting AttendPro...
npm run dev
pause
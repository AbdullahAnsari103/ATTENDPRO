// AttendPro Welcome Page Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize real-time clock
    updateTime();
    setInterval(updateTime, 1000);
    
    // Initialize interactive elements
    initializeInteractions();
    
    // Animate stats on load
    animateStatsCounters();
    
    // Add entrance animations
    addEntranceAnimations();
});

function updateTime() {
    const now = new Date();
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const dateOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    document.getElementById('current-time').textContent = now.toLocaleTimeString('en-US', timeOptions);
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', dateOptions);
}

function initializeInteractions() {
    const buttons = document.querySelectorAll('.btn');
    const features = document.querySelectorAll('.feature');
    const statCards = document.querySelectorAll('.stat-card');
    
    // Button interactions with ripple effect
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            createRippleEffect(this, e);
        });
        
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Feature card interactions
    features.forEach((feature, index) => {
        feature.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
            this.style.zIndex = '20';
        });
        
        feature.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.zIndex = '10';
        });
        
        // Add click animation
        feature.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'translateY(-10px) scale(1.02)';
            }, 150);
        });
    });
    
    // Stat card interactions
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.querySelector('.stat-icon').style.transform = 'rotate(10deg) scale(1.1)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.querySelector('.stat-icon').style.transform = 'rotate(0deg) scale(1)';
        });
    });
}

function createRippleEffect(element, event) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        transform: scale(0);
        animation: ripple-effect 0.6s linear;
        pointer-events: none;
        z-index: 1000;
    `;
    
    element.style.position = 'relative';
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

function startAttendance() {
    const btn = event.target.closest('.btn');
    const originalContent = btn.innerHTML;
    
    // Show loading state
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing...';
    btn.disabled = true;
    
    // Simulate loading process
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-qrcode"></i> Ready to Scan';
        setTimeout(() => {
            showAttendanceModal();
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }, 1000);
    }, 2000);
}

function viewReports() {
    const btn = event.target.closest('.btn');
    const originalContent = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Reports...';
    btn.disabled = true;
    
    setTimeout(() => {
        showReportsModal();
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }, 1500);
}

function showHelp() {
    showModal({
        title: '<i class="fas fa-question-circle"></i> How AttendPro Works',
        content: `
            <div class="help-content">
                <div class="help-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h3>Setup Your Class</h3>
                        <p>Create a new class session and generate a unique QR code</p>
                    </div>
                </div>
                <div class="help-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h3>Students Scan</h3>
                        <p>Students use their mobile devices to scan the QR code</p>
                    </div>
                </div>
                <div class="help-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h3>Automatic Recording</h3>
                        <p>Attendance is automatically recorded with timestamp and location</p>
                    </div>
                </div>
                <div class="help-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h3>Generate Reports</h3>
                        <p>View detailed analytics and export attendance reports</p>
                    </div>
                </div>
                <div class="features-highlight">
                    <h3>Key Features:</h3>
                    <ul>
                        <li>✅ Real-time attendance tracking</li>
                        <li>📱 Mobile-friendly interface</li>
                        <li>🔒 Secure data encryption</li>
                        <li>📊 Advanced analytics dashboard</li>
                        <li>📧 Automated notifications</li>
                        <li>💾 Cloud-based storage</li>
                    </ul>
                </div>
            </div>
        `,
        primaryButton: 'Get Started',
        primaryAction: () => {
            closeModal();
            startAttendance();
        }
    });
}

function showAttendanceModal() {
    showModal({
        title: '<i class="fas fa-qrcode"></i> QR Code Scanner Ready',
        content: `
            <div class="scanner-content">
                <div class="qr-display">
                    <div class="qr-code-placeholder">
                        <i class="fas fa-qrcode"></i>
                        <p>QR Code will appear here</p>
                    </div>
                </div>
                <div class="scanner-info">
                    <h3>Session: Computer Science 101</h3>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
                    <p><strong>Duration:</strong> 2 hours</p>
                </div>
                <div class="attendance-stats">
                    <div class="stat">
                        <span class="stat-value">0</span>
                        <span class="stat-label">Present</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">45</span>
                        <span class="stat-label">Expected</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">0%</span>
                        <span class="stat-label">Attendance</span>
                    </div>
                </div>
            </div>
        `,
        primaryButton: 'Start Session',
        secondaryButton: 'Cancel'
    });
}

function showReportsModal() {
    showModal({
        title: '<i class="fas fa-chart-bar"></i> Attendance Reports',
        content: `
            <div class="reports-content">
                <div class="report-summary">
                    <div class="summary-card">
                        <h3>Today's Overview</h3>
                        <div class="summary-stats">
                            <div class="summary-stat">
                                <span class="value">87%</span>
                                <span class="label">Average Attendance</span>
                            </div>
                            <div class="summary-stat">
                                <span class="value">12</span>
                                <span class="label">Classes Conducted</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="recent-sessions">
                    <h3>Recent Sessions</h3>
                    <div class="session-list">
                        <div class="session-item">
                            <div class="session-info">
                                <strong>Mathematics 201</strong>
                                <span>Today, 10:00 AM</span>
                            </div>
                            <div class="session-attendance">92%</div>
                        </div>
                        <div class="session-item">
                            <div class="session-info">
                                <strong>Physics 301</strong>
                                <span>Today, 2:00 PM</span>
                            </div>
                            <div class="session-attendance">85%</div>
                        </div>
                        <div class="session-item">
                            <div class="session-info">
                                <strong>Chemistry 101</strong>
                                <span>Yesterday, 11:00 AM</span>
                            </div>
                            <div class="session-attendance">78%</div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        primaryButton: 'View Detailed Report',
        secondaryButton: 'Export Data'
    });
}

function showModal({ title, content, primaryButton = 'OK', secondaryButton = null, primaryAction = null }) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const secondaryBtn = secondaryButton ? 
        `<button class="btn secondary" onclick="closeModal()">${secondaryButton}</button>` : '';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            <div class="modal-footer">
                ${secondaryBtn}
                <button class="btn primary" onclick="${primaryAction ? 'window.modalPrimaryAction()' : 'closeModal()'}">
                    ${primaryButton}
                </button>
            </div>
        </div>
    `;
    
    if (primaryAction) {
        window.modalPrimaryAction = primaryAction;
    }
    
    document.body.appendChild(modal);
    
    // Add modal styles
    addModalStyles();
    
    // Auto close after 30 seconds
    setTimeout(() => {
        if (document.body.contains(modal)) {
            closeModal();
        }
    }, 30000);
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'modalFadeOut 0.3s ease forwards';
        setTimeout(() => {
            if (document.body.contains(modal)) {
                modal.remove();
            }
            if (window.modalPrimaryAction) {
                delete window.modalPrimaryAction;
            }
        }, 300);
    }
}

function addModalStyles() {
    if (document.getElementById('modal-styles')) return;
    
    const modalStyles = `
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: modalFadeIn 0.3s ease;
            padding: 20px;
        }
        
        .modal-content {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 25px;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            animation: modalSlideIn 0.4s ease;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
        }
        
        .modal-header {
            background: linear-gradient(45deg, #1e3c72, #2a5298);
            color: white;
            padding: 25px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 25px 25px 0 0;
        }
        
        .modal-header h2 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
        }
        
        .close-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: rotate(90deg);
        }
        
        .modal-body {
            padding: 30px;
            color: #333;
            line-height: 1.6;
        }
        
        .modal-footer {
            padding: 20px 30px;
            display: flex;
            gap: 15px;
            justify-content: flex-end;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            background: rgba(248, 249, 250, 0.8);
            border-radius: 0 0 25px 25px;
        }
        
        .help-content .help-step {
            display: flex;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 25px;
            padding: 20px;
            background: rgba(76, 175, 80, 0.1);
            border-radius: 15px;
            border-left: 4px solid #4CAF50;
        }
        
        .step-number {
            width: 40px;
            height: 40px;
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2rem;
            flex-shrink: 0;
        }
        
        .step-content h3 {
            margin: 0 0 8px 0;
            color: #2E7D32;
            font-size: 1.1rem;
        }
        
        .step-content p {
            margin: 0;
            color: #555;
        }
        
        .features-highlight {
            margin-top: 30px;
            padding: 20px;
            background: rgba(33, 150, 243, 0.1);
            border-radius: 15px;
            border-left: 4px solid #2196F3;
        }
        
        .features-highlight h3 {
            color: #1976D2;
            margin-bottom: 15px;
        }
        
        .features-highlight ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .features-highlight li {
            padding: 8px 0;
            font-size: 0.95rem;
        }
        
        .scanner-content {
            text-align: center;
        }
        
        .qr-display {
            margin: 20px 0;
            padding: 40px;
            background: #f8f9fa;
            border-radius: 15px;
            border: 2px dashed #ddd;
        }
        
        .qr-code-placeholder {
            color: #999;
        }
        
        .qr-code-placeholder i {
            font-size: 80px;
            margin-bottom: 15px;
            display: block;
        }
        
        .scanner-info {
            background: rgba(76, 175, 80, 0.1);
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            text-align: left;
        }
        
        .scanner-info h3 {
            color: #2E7D32;
            margin-bottom: 15px;
        }
        
        .scanner-info p {
            margin: 8px 0;
        }
        
        .attendance-stats {
            display: flex;
            justify-content: space-around;
            margin-top: 25px;
        }
        
        .attendance-stats .stat {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            min-width: 80px;
        }
        
        .stat-value {
            display: block;
            font-size: 1.8rem;
            font-weight: bold;
            color: #4CAF50;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 0.85rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .reports-content .report-summary {
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            padding: 25px;
            border-radius: 15px;
            text-align: center;
        }
        
        .summary-card h3 {
            margin-bottom: 20px;
            font-size: 1.3rem;
        }
        
        .summary-stats {
            display: flex;
            justify-content: space-around;
        }
        
        .summary-stat {
            text-align: center;
        }
        
        .summary-stat .value {
            display: block;
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .summary-stat .label {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        
        .recent-sessions h3 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.2rem;
        }
        
        .session-list {
            space-y: 15px;
        }
        
        .session-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: #f8f9fa;
            border-radius: 12px;
            margin-bottom: 10px;
            border-left: 4px solid #4CAF50;
        }
        
        .session-info strong {
            display: block;
            color: #333;
            margin-bottom: 5px;
        }
        
        .session-info span {
            color: #666;
            font-size: 0.9rem;
        }
        
        .session-attendance {
            font-size: 1.2rem;
            font-weight: bold;
            color: #4CAF50;
            background: white;
            padding: 8px 15px;
            border-radius: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        @keyframes modalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes modalSlideIn {
            from { 
                transform: scale(0.7) translateY(-50px); 
                opacity: 0; 
            }
            to { 
                transform: scale(1) translateY(0); 
                opacity: 1; 
            }
        }
        
        @keyframes modalFadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        @keyframes ripple-effect {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        @media (max-width: 768px) {
            .modal-content {
                margin: 10px;
                max-height: 90vh;
            }
            
            .help-step {
                flex-direction: column;
                text-align: center;
            }
            
            .attendance-stats {
                flex-direction: column;
                gap: 15px;
            }
            
            .summary-stats {
                flex-direction: column;
                gap: 15px;
            }
            
            .session-item {
                flex-direction: column;
                gap: 10px;
                text-align: center;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'modal-styles';
    styleSheet.textContent = modalStyles;
    document.head.appendChild(styleSheet);
}

function animateStatsCounters() {
    const statNumbers = document.querySelectorAll('.stat-number');
    const targets = ['2.5K+', '150+', '98.5%', '5 Min'];
    
    statNumbers.forEach((stat, index) => {
        const target = targets[index];
        const isPercentage = target.includes('%');
        const hasK = target.includes('K');
        const hasMin = target.includes('Min');
        
        let current = 0;
        const numericTarget = parseFloat(target.replace(/[^\d.]/g, ''));
        
        const animate = () => {
            if (hasMin) {
                current += 0.1;
                if (current >= numericTarget) {
                    stat.textContent = target;
                    return;
                }
                stat.textContent = Math.floor(current) + ' Min';
            } else if (isPercentage) {
                current += 1.2;
                if (current >= numericTarget) {
                    stat.textContent = target;
                    return;
                }
                stat.textContent = current.toFixed(1) + '%';
            } else if (hasK) {
                current += 0.1;
                if (current >= numericTarget) {
                    stat.textContent = target;
                    return;
                }
                stat.textContent = current.toFixed(1) + 'K+';
            } else {
                current += 3;
                if (current >= numericTarget) {
                    stat.textContent = target;
                    return;
                }
                stat.textContent = Math.floor(current) + '+';
            }
            
            setTimeout(animate, 50);
        };
        
        setTimeout(() => animate(), index * 300);
    });
}

function addEntranceAnimations() {
    const features = document.querySelectorAll('.feature');
    const statCards = document.querySelectorAll('.stat-card');
    
    // Animate features
    features.forEach((feature, index) => {
        feature.style.opacity = '0';
        feature.style.transform = 'translateY(50px)';
        feature.style.transition = 'all 0.6s ease';
        
        setTimeout(() => {
            feature.style.opacity = '1';
            feature.style.transform = 'translateY(0)';
        }, 300 + (index * 150));
    });
    
    // Animate stat cards
    statCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateX(50px)';
        card.style.transition = 'all 0.6s ease';
        
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateX(0)';
        }, 600 + (index * 200));
    });
}
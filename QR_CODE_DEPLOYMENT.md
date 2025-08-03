# 📱 QR Code Deployment Guide - AttendPro

## 🔄 **QR Codes Will Change When You Go Live**

### **Current (Local Development):**
```
http://localhost:3000/student-register/[CLASS_ID]
```

### **Live (After Deployment):**
```
https://your-domain.com/student-register/[CLASS_ID]
```

## ✅ **Automatic QR Code Updates**

The system is now configured to **automatically** update QR codes when you deploy live!

### **How It Works:**
1. **Local Development**: Uses `localhost:3000`
2. **Live Deployment**: Uses your live domain from environment variables
3. **Automatic Switch**: No manual changes needed

## 🔧 **Environment Variable Setup**

### **For Netlify Deployment:**
Add this environment variable in your Netlify dashboard:

```env
DOMAIN=https://your-netlify-domain.netlify.app
```

### **For Other Hosting Services:**
```env
DOMAIN=https://your-domain.com
```

## 📱 **QR Code Behavior**

### **Before Live Deployment:**
- QR codes point to `localhost:3000`
- Only works on your computer
- Students get "Connection Failed" error

### **After Live Deployment:**
- QR codes automatically point to your live domain
- Works from anywhere in the world
- Students can register successfully

## 🚀 **Deployment Steps**

1. **Deploy to Netlify** (or your chosen hosting)
2. **Set Environment Variable**: `DOMAIN=https://your-domain.com`
3. **QR Codes Update Automatically** ✅
4. **Test QR Codes** on live site

## 📋 **Testing Checklist**

- [ ] Deploy to live hosting
- [ ] Set `DOMAIN` environment variable
- [ ] Generate new QR codes on live site
- [ ] Test QR code scanning from different devices
- [ ] Verify student registration works

## ⚠️ **Important Notes**

- **Old QR Codes**: Will stop working when you go live
- **New QR Codes**: Must be generated on the live site
- **Environment Variable**: Must be set correctly
- **Testing**: Always test QR codes after deployment

## 🎯 **Success Criteria**

✅ QR codes work from any device  
✅ Students can register successfully  
✅ No "localhost" errors  
✅ Works globally  

---

**Your QR codes will automatically update when you deploy live!** 🚀 
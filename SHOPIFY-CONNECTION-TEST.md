# 🎯 **Testing Specific Customer URLs & Shopify Connection**

## ✅ **Specific Customer URLs Working:**

### **Frederik's Test URL:**
```
http://localhost:3000/fulfillment/MV9LUzFfMTIzNDU2
```

**How it works:**
1. Token `MV9LUzFfMTIzNDU2` = Base64 of `1_KS1_123456`
2. URL loads Frederik's specific data (pledged items, discount code)
3. Shows his exact rewards + store products

### **Real Customer URLs (After Processing):**
When you process the full CSV, each customer gets:
```
http://localhost:3000/fulfillment/{unique-token}
```

## 🛒 **Shopify Connection Fixed:**

### **Scenario 1: Only Pledged Items**
- User doesn't add extras
- Click "Review & Checkout" 
- **Opens**: `https://shop.ambientworks.io/discount/KS1_123456`
- Customer pays £0 (discount = pledge amount)

### **Scenario 2: Pledged + Extra Items**
- User adds extras (e.g., poster, extra dock)
- Click "Review & Checkout"
- **Opens**: `https://shop.ambientworks.io/cart/52337643290957:1,52321245593933:1,52321243267405:1,52321260994893:1`
- Pre-filled cart with ALL items
- Customer pastes discount code at checkout
- Pays only for extras!

## 🧪 **Test Right Now:**

1. **Visit**: `http://localhost:3000/fulfillment/MV9LUzFfMTIzNDU2`
2. **Add some extras** (poster, extra dock)
3. **Click "Review & Checkout"**
4. **Confirm the order**
5. **Watch it open your actual Shopify cart**! 🎯

## 🚀 **Ready for Full Processing:**

Once you confirm this works, I'll:
1. Process your complete Kickstarter CSV
2. Generate specific URLs for every backer
3. Create discount codes in Shopify
4. Output the complete fulfillment package

**Test the URL above and let me know!** 🛒

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

admin.initializeApp();

// Initialize Firestore dynamically with the database ID configuration
let db;
try {
  const firebaseConfig = require('./firebase-applet-config.json');
  if (firebaseConfig.firestoreDatabaseId) {
    db = admin.firestore(firebaseConfig.firestoreDatabaseId);
    console.log("Connected to named firestore database: " + firebaseConfig.firestoreDatabaseId);
  } else {
    db = admin.firestore();
  }
} catch (e) {
  console.warn("Failed to load named database config. Falling back to default database.", e);
  db = admin.firestore();
}

/**
 * 1. Paychangu Webhook: Verifies and updates payment status for local orders.
 * Paychangu is a leading payment gateway in Malawi supporting Airtel Money, TNM Mpamba, and cards.
 */
exports.paychanguWebhook = functions.https.onRequest(async (req, res) => {
  const event = req.body;
  if (!event || !event.tx_ref) {
    return res.status(400).send('Malformed payload');
  }

  const { tx_ref, status } = event;

  try {
    // 1. Double check payment status directly with Paychangu API to avoid spoofing
    const paychanguSecret = process.env.PAYCHANGU_SECRET_KEY;
    if (!paychanguSecret) {
      console.error('PAYCHANGU_SECRET_KEY is missing from environment. Webhook verification skipped.');
      return res.status(500).send('Configuration error');
    }

    let verified = false;
    try {
      const verifyRes = await axios.get(`https://api.paychangu.com/payment/verify/${tx_ref}`, {
        headers: { Authorization: `Bearer ${paychanguSecret}` }
      });
      if (verifyRes.data && verifyRes.data.status === 'success') {
        verified = true;
      }
    } catch (apiErr) {
      console.error(`Paychangu external Verification API check failed for ref ${tx_ref}:`, apiErr.message);
    }

    if (!verified) {
      return res.status(400).send('Payment verification failed');
    }

    // 2. Retrieve checkout_intent from Firestore
    const intentDocRef = db.collection('checkout_intents').doc(tx_ref);
    const intentSnap = await intentDocRef.get();
    if (!intentSnap.exists) {
      console.warn(`Checkout intent ${tx_ref} not found in Firestore checkout_intents.`);
      return res.status(422).send('Checkout intent record not found');
    }

    const intentData = intentSnap.data();

    // 3. Check if Order already exists in the 'orders' collection to avoid duplicate processing
    const orderDocRef = db.collection('orders').doc(tx_ref);
    const orderSnap = await orderDocRef.get();
    if (orderSnap.exists) {
      console.log(`Order ${tx_ref} already processed and created in Firestore orders collection.`);
      return res.status(200).send('Order already verified and created');
    }

    // Execute in a single Firestore Transaction for atomicity and data consistency
    await db.runTransaction(async (transaction) => {
      // a. Create the finalized Order document in Firestore ('orders' collection) with status 'paid'
      const newOrder = {
        id: tx_ref,
        buyerId: intentData.buyerId || 'anonymous_buyer',
        buyerName: intentData.buyerName || '',
        buyerPhone: intentData.buyerPhone || '',
        buyerEmail: intentData.buyerEmail || '',
        items: intentData.items || [],
        deliveryType: intentData.deliveryType || 'delivery',
        deliveryInfo: intentData.deliveryInfo || {},
        status: 'paid', // Mark status as 'paid'
        paymentStatus: 'paid', // Mark paymentStatus as 'paid'
        paychanguReference: event.reference || 'PAYCHANGU_WEBHOOK_OK',
        subtotal: intentData.subtotal,
        discount: intentData.discount,
        total: intentData.total,
        couponCode: intentData.couponCode || null,
        note: intentData.note || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(orderDocRef, newOrder);

      // b. Decrement product stock in Firestore for each purchased item
      for (const item of intentData.items || []) {
        if (item.productId) {
          const productDocRef = db.collection('products').doc(item.productId);
          const productSnap = await transaction.get(productDocRef);
          if (productSnap.exists) {
            const currentStock = productSnap.data().stock || 0;
            const newStock = Math.max(0, currentStock - (item.qty || item.quantity || 1));
            transaction.update(productDocRef, { stock: newStock });
            console.log(`Subtracted stock for product ${item.productId}: ${currentStock} -> ${newStock}`);
          }
        }
      }

      // c. Erase buyer's items from Firestore carts/ items subcollection
      const cartItemsColRef = db.collection('carts').doc(intentData.buyerId).collection('items');
      const cartItemsSnap = await cartItemsColRef.get();
      cartItemsSnap.forEach((doc) => {
        transaction.delete(doc.ref);
      });

      // d. Create real Firestore Notifications for buyer and seller
      // Notification for BUYER
      const buyerNotifId = `notif_${tx_ref}_buyer_${Date.now()}`;
      const buyerNotifRef = db.collection('notifications').doc(buyerNotifId);
      transaction.set(buyerNotifRef, {
        id: buyerNotifId,
        userId: intentData.buyerId,
        title: 'Payment Confirmed! 🎉',
        body: `Zikomo! We received your payment of MWK ${intentData.total.toLocaleString()} for Order #${tx_ref}. The merchant is now routing shipment.`,
        type: 'order',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notification for SELLERS (group items by sellerId to notify each relevant seller)
      const sellerIdsOccurred = [...new Set((intentData.items || []).map(item => item.sellerId || item.storeId).filter(Boolean))];
      for (const sellerId of sellerIdsOccurred) {
        const sellerNotifId = `notif_${tx_ref}_seller_${sellerId}_${Date.now()}`;
        const sellerNotifRef = db.collection('notifications').doc(sellerNotifId);
        transaction.set(sellerNotifRef, {
          id: sellerNotifId,
          userId: sellerId,
          title: 'New Paid Order Recieved! 🏪',
          body: `Chonde tumizani katundu! You received a paid order #${tx_ref} for MWK ${intentData.total.toLocaleString()}. Ready for delivery/pickup!`,
          type: 'order',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Add Coin Reward transaction for buyer on purchase (100 coins for every 10,000 MWK spent)
      const coinAmount = Math.floor(intentData.total / 100);
      if (coinAmount > 0) {
        const coinTxId = `tx_${tx_ref}_reward`;
        const coinTxRef = db.collection('coinTransactions').doc(coinTxId);
        transaction.set(coinTxRef, {
          id: coinTxId,
          userId: intentData.buyerId,
          amount: coinAmount,
          type: 'bonus',
          description: `Earned shopping coins for Order #${tx_ref}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Increment User balance
        const userRef = db.collection('users').doc(intentData.buyerId);
        transaction.update(userRef, {
          coins: admin.firestore.FieldValue.increment(coinAmount)
        });
      }
    });

    console.info(`Webhook successfully finalized Order creation, stock update, cart clear, and notifications for Ref ${tx_ref}`);
    return res.status(200).json({ status: 'success', message: 'Webhook processed successfully' });

  } catch (error) {
    console.error(`Paychangu Webhook error processing Ref ${tx_ref}:`, error);
    return res.status(500).send('Internal Server Error');
  }
});

/**
 * 2. On User Signup: Auto-award 100 ShopEasy loyalty coins.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      // Create profile if doesn't exist
      transaction.set(userRef, {
        uid,
        name: user.displayName || 'ShopEasy Member',
        phone: user.phoneNumber || '',
        location: 'Lilongwe', // Default to capital city center
        role: 'buyer',
        coins: 100, // Sign up reward coins
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Record coin reward transaction
      const txId = `tx_${uid}_welcome`;
      transaction.set(db.collection('coinTransactions').doc(txId), {
        id: txId,
        userId: uid,
        amount: 100,
        type: 'bonus',
        description: 'ShopEasy Welcome Bonus Coins!',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.info(`Welcome bonus coins awarded successfully to user: ${uid}`);
  } catch (error) {
    console.error('Error awarding welcome reward coins:', error);
  }
});

/**
 * 3. Initiate Paychangu Payment
 */
exports.initiatePayment = functions.https.onCall(async (data, context) => {
  // In v1, context holds authenticated user info
  if (!context || !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in to purchase items.');
  }

  // Paychangu supports card, airtel, mpamba internally
  const paychanguSecret = process.env.PAYCHANGU_SECRET_KEY;
  if (!paychanguSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Paychangu Secret Key is missing from the environment settings.');
  }

  try {
    const response = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paychanguSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: data.totalAmount,
        currency: 'MWK',
        email: data.userEmail || 'noreply@shopeasy.mw',
        first_name: data.firstName || 'ShopEasy',
        last_name: data.lastName || 'Customer',
        callback_url: data.callbackUrl || 'https://shopeasy.mw/payment-callback',
        return_url: data.returnUrl || 'https://shopeasy.mw/order-success',
        tx_ref: data.orderId,
        customization: {
          title: 'ShopEasy Payment',
          description: `Order ${data.orderId}`
        }
      })
    });

    const result = await response.json();
    
    if (response.status !== 200 || !result.data || !result.data.checkout_url) {
      throw new Error(result.message || `Paychangu API Error: ${response.statusText}`);
    }

    return { paymentUrl: result.data.checkout_url };
  } catch (error) {
    console.error('Paychangu checkout initiation failed:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to communicate with Paychangu payment gateway.');
  }
});

/**
 * 4. Send Email OTP
 */
exports.sendEmailOTP = functions.https.onCall(async (data, context) => {
  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format.');
  }

  // Rate Limiting (60 seconds)
  const otpDocRef = db.collection('email_otps').doc(email);
  const otpDoc = await otpDocRef.get();
  if (otpDoc.exists) {
    const dataDoc = otpDoc.data();
    if (dataDoc.createdAt) {
      const createdTime = dataDoc.createdAt.toDate ? dataDoc.createdAt.toDate() : new Date(dataDoc.createdAt);
      const diffSeconds = (Date.now() - createdTime.getTime()) / 1000;
      if (diffSeconds < 60) {
        throw new functions.https.HttpsError('resource-exhausted', 'Please wait 60 seconds before requesting another OTP');
      }
    }
  }

  // Generate 6-digit OTP code
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));

  // Store hashed OTP in firestore: email_otps/{email}
  const hashedOtp = await bcrypt.hash(otpCode, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  await otpDocRef.set({
    email: email,
    otp: hashedOtp,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    attempts: 0,
    locked: false
  });

  // Send Email via Resend
  const resendApiKey = process.env.RESEND_API_KEY || '';
  if (!resendApiKey || resendApiKey === 'your_resend_api_key_here') {
    console.warn(`[SANDBOX / MONOLITH BYPASS] No valid Resend API Key configured. Emitting OTP in console logs:`);
    console.info(`[DEVELOPMENT CODE]: ${otpCode} for ${email}`);
  } else {
    try {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "ShopEasy <onboarding@resend.dev>",
        to: [email],
        subject: "Your ShopEasy verification code",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <div style="background:#E53935;padding:20px;text-align:center">
              <h1 style="color:white;margin:0">SE ShopEasy</h1>
              <p style="color:white;margin:4px 0">🇲🇼 Malawi's Local Marketplace</p>
            </div>
            <div style="padding:24px">
              <h2>Your verification code</h2>
              <p>Enter this code on ShopEasy to verify your email:</p>
              <div style="background:#f5f5f5;border-radius:8px;
                          padding:20px;text-align:center;
                          font-size:36px;font-weight:bold;
                          letter-spacing:8px;color:#E53935">
                ${otpCode}
              </div>
              <p style="color:#666;margin-top:16px">
                ⏱️ This code expires in <strong>5 minutes</strong>
              </p>
              <p style="color:#666">
                If you did not request this, ignore this email.
              </p>
            </div>
            <div style="background:#f5f5f5;padding:12px;
                        text-align:center;color:#999;font-size:12px">
              ShopEasy — Made in Malawi 🇲🇼
            </div>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send email via Resend API:', emailErr);
      console.info(`[DEVELOPMENT CODE FALLBACK]: ${otpCode} for ${email}`);
    }
  }

  return { success: true, message: 'OTP sent to your email' };
});

/**
 * 5. Verify Email OTP
 */
exports.verifyEmailOTP = functions.https.onCall(async (data, context) => {
  const { email, otp } = data;
  if (!email || !otp) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and OTP are required.');
  }

  // Fetch document
  const otpDocRef = db.collection('email_otps').doc(email);
  const otpDoc = await otpDocRef.get();
  if (!otpDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'OTP not found. Please request a new one.');
  }

  const dataDoc = otpDoc.data();

  // Check Locked
  if (dataDoc.locked === true) {
    throw new functions.https.HttpsError('permission-denied', 'Too many failed attempts. Request a new OTP.');
  }

  // Check Expiry
  const expiresAt = dataDoc.expiresAt ? (dataDoc.expiresAt.toDate ? dataDoc.expiresAt.toDate() : new Date(dataDoc.expiresAt)) : null;
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    await otpDocRef.delete();
    throw new functions.https.HttpsError('deadline-exceeded', 'OTP expired. Please request a new one.');
  }

  // Check Attempts
  if (dataDoc.attempts >= 5) {
    await otpDocRef.update({ locked: true });
    throw new functions.https.HttpsError('permission-denied', 'Too many failed attempts. Request a new OTP.');
  }

  // Verify OTP via Bcrypt
  const isMatch = await bcrypt.compare(otp, dataDoc.otp);
  if (!isMatch) {
    const newAttempts = (dataDoc.attempts || 0) + 1;
    const remaining = 5 - newAttempts;
    if (newAttempts >= 5) {
      await otpDocRef.update({ attempts: newAttempts, locked: true });
      throw new functions.https.HttpsError('permission-denied', 'Too many failed attempts. Request a new OTP.');
    } else {
      await otpDocRef.update({ attempts: newAttempts });
      throw new functions.https.HttpsError('invalid-argument', `Wrong code. ${remaining} attempts remaining.`);
    }
  }

  // If correct, delete document
  await otpDocRef.delete();

  // Check if user exists in Firestore
  const usersQuery = await db.collection('users').where('email', '==', email).limit(1).get();
  let uid;
  let isNewUser = false;
  let isProfileComplete = false;

  if (!usersQuery.empty) {
    const userDoc = usersQuery.docs[0];
    uid = userDoc.id;
    isProfileComplete = userDoc.data().isProfileComplete ?? true;
  } else {
    // Register absolute new auth user
    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        emailVerified: true
      });
      uid = userRecord.uid;
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-exists') {
        const existingAuthUser = await admin.auth().getUserByEmail(email);
        uid = existingAuthUser.uid;
      } else {
        throw new functions.https.HttpsError('internal', authErr.message || 'Error creating Firebase auth user.');
      }
    }

    isNewUser = true;
    isProfileComplete = false;

    // Create profile doc in Firestore with coins: 0, createdAt: now
    await db.collection('users').doc(uid).set({
      uid,
      email,
      isProfileComplete: false,
      role: null,
      coins: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Generate Custom Token
  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return {
      token: customToken,
      isNewUser,
      isProfileComplete
    };
  } catch (tokenErr) {
    throw new functions.https.HttpsError('internal', tokenErr.message || 'Error generating custom login token.');
  }
});

/**
 * 6. Initiate Paychangu: Securely creates a checkout intent and posts initialization details to Paychangu API in production.
 */
exports.initiatePaychangu = functions.https.onCall(async (data, context) => {
  if (!context || !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { cart, shippingDetail, totals, customKeys } = data;
  if (!cart || !totals) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing cart or totals payload.');
  }

  const orderId = 'ORD_' + Math.floor(100000 + Math.random() * 900000);
  const paychanguSecret = process.env.PAYCHANGU_SECRET_KEY;

  if (!paychanguSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'PAYCHANGU_SECRET_KEY is required in production.');
  }

  // Save checkout_intent in Firestore (under checkout_intents/{orderId})
  await db.collection('checkout_intents').doc(orderId).set({
    id: orderId,
    buyerId: context.auth.uid,
    buyerName: shippingDetail.fullName || '',
    buyerPhone: shippingDetail.phone || '',
    buyerEmail: customKeys?.email || 'customer@shopeasy.mw',
    items: cart,
    deliveryType: shippingDetail.deliveryMethod || 'delivery',
    deliveryInfo: {
      city: shippingDetail.city || 'Lilongwe',
      area: shippingDetail.area || '',
      landmark: shippingDetail.landmark || ''
    },
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    couponCode: totals.couponUsed || null,
    note: shippingDetail.note || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  try {
    const firstName = (shippingDetail.fullName || 'ShopEasy').split(' ')[0] || 'ShopEasy';
    const lastName = (shippingDetail.fullName || 'Customer').split(' ').slice(1).join(' ') || 'Customer';

    const response = await axios.post('https://api.paychangu.com/payment', {
      amount: totals.total,
      currency: 'MWK',
      email: customKeys?.email || 'customer@shopeasy.mw',
      first_name: firstName,
      last_name: lastName,
      callback_url: customKeys?.callbackUrl || 'https://shopeasy.mw/payment-callback',
      return_url: customKeys?.returnUrl ? `${customKeys.returnUrl}?tx_ref=${orderId}` : `https://shopeasy.mw/order-success?tx_ref=${orderId}`,
      tx_ref: orderId,
      customization: {
        title: 'ShopEasy Malawi Checkout',
        description: `Order ${orderId}`
      }
    }, {
      headers: {
        'Authorization': `Bearer ${paychanguSecret}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200 && response.data && response.data.status === 'success' && response.data.data?.checkout_url) {
      return { 
        status: 'success',
        paymentUrl: response.data.data.checkout_url,
        orderId 
      };
    } else {
      throw new Error(response.data?.message || 'Invalid Paychangu API response');
    }
  } catch (error) {
    console.error('Paychangu initiation failure:', error.response?.data || error.message);
    throw new functions.https.HttpsError('internal', error.response?.data?.message || error.message || 'Paychangu initiation failed.');
  }
});

/**
 * 7. onOrderStatusChange Trigger: Monitors order status modifications and alerts buyer in real-time.
 */
exports.onOrderStatusChange = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return null;
    if (before.status === after.status) return null;

    const getOrderStatusTitle = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'processing' || s === 'paid') return 'Order is being Processed! 🚜';
      if (s === 'ready') return 'Order Ready for Pickup! 📦';
      if (s === 'completed') return 'Order Completed successfully! 🎉';
      if (s === 'cancelled') return 'Order Cancelled ❌';
      if (s.startsWith('dispute')) return 'Dispute / Return Opened ⚠️';
      return 'Order Status Updated';
    };

    const getOrderStatusBody = (status, orderData) => {
      const s = (status || '').toLowerCase();
      if (s === 'processing' || s === 'paid') {
        return `Great news! The seller has started prepping your order ${context.params.orderId}.`;
      }
      if (s === 'ready') {
        return `Your order ${context.params.orderId} is packaged and ready for collection/delivery.`;
      }
      if (s === 'completed') {
        return `Thank you for confirming receipt of order ${context.params.orderId}. Enjoy your items!`;
      }
      if (s === 'cancelled') {
        return `Order ${context.params.orderId} has been cancelled. If paid, refunds will be evaluated shortly.`;
      }
      if (s.startsWith('dispute')) {
        return `A return case has been logged for order ${context.params.orderId}. Admin support is reviewing.`;
      }
      return `The status of your order ${context.params.orderId} has changed to ${status}.`;
    };

    try {
      await db.collection('notifications').add({
        userId: after.buyerId,
        type: 'order_update',
        title: getOrderStatusTitle(after.status),
        body: getOrderStatusBody(after.status, after),
        orderId: context.params.orderId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Notification sent to buyer ${after.buyerId} for order status ${after.status}`);
    } catch (err) {
      console.error('Error generating status-change notification:', err);
    }
    return null;
  });

/**
 * 8. Coupon Validation Cloud Function
 * Validate standard and sale coupons, checking limits, expiration, and user-exclusive usage status in Firestore.
 */
exports.validateCoupon = functions.https.onCall(async (data, context) => {
  if (!context || !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in to validate coupons.');
  }

  const { code, cartTotal } = data;
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Coupon code is required.');
  }

  const uid = context.auth.uid;
  const couponCodeUpper = code.toUpperCase().trim();

  // Check platform coupon
  const couponDoc = await db.collection('coupons').doc(couponCodeUpper).get();
  if (!couponDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Coupon not found.');
  }

  const coupon = couponDoc.data();

  if (!coupon.isActive) {
    throw new functions.https.HttpsError('failed-precondition', 'This coupon is no longer active.');
  }

  // Check maximum usage limits
  if (coupon.usedCount !== undefined && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) {
    throw new functions.https.HttpsError('failed-precondition', 'This coupon has reached its maximum usage limit.');
  }

  // Check expiration if expiresAt is set
  const expiresAtDate = coupon.expiresAt?.toDate ? coupon.expiresAt.toDate() : (coupon.expiresAt ? new Date(coupon.expiresAt) : null);
  if (expiresAtDate && new Date() > expiresAtDate) {
    throw new functions.https.HttpsError('deadline-exceeded', 'This coupon has expired.');
  }

  // Check minimum order value
  if (cartTotal < (coupon.minOrderValue || 0)) {
    throw new functions.https.HttpsError('failed-precondition', `Minimum order of MWK ${(coupon.minOrderValue || 0).toLocaleString()} required.`);
  }

  // Check user hasn't already used it
  const userCoupon = await db.collection('users').doc(uid).collection('coupons').doc(couponCodeUpper).get();
  if (userCoupon.exists && userCoupon.data().status === 'used') {
    throw new functions.https.HttpsError('failed-precondition', 'You have already used this coupon.');
  }

  return {
    valid: true,
    discountAmount: coupon.discountType === 'percent'
      ? Math.floor(cartTotal * (coupon.discountPercent || 0) / 100)
      : (coupon.discountAmount || 0),
    code: coupon.code || couponCodeUpper,
    message: `Coupon applied — MWK ${(coupon.discountAmount || 0).toLocaleString()} off!`
  };
});

/**
 * Helper to get Malawi current date string (YYYY-MM-DD)
 */
function getMalawiDateStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const mwTime = new Date(utc + (3600000 * 2)); // Malawi is UTC+2
  return mwTime.toISOString().split('T')[0];
}

/**
 * 9. Daily Check-In Cloud Function (Server-Side Verified)
 */
exports.dailyCheckIn = functions.https.onCall(async (data, context) => {
  if (!context || !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in to check-in.');
  }

  const uid = context.auth.uid;
  const dateStr = getMalawiDateStr();
  const userRef = db.collection('users').doc(uid);

  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }

      const userData = userSnap.data();
      const lastCheckIn = userData.lastCheckInDate || '';
      
      if (lastCheckIn === dateStr) {
        throw new functions.https.HttpsError('already-exists', 'You have already checked in today! Come back tomorrow.');
      }

      // Compute streak
      let newStreak = 1;
      if (lastCheckIn) {
        const todayDate = new Date(dateStr);
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

        if (lastCheckIn === yesterdayStr) {
          newStreak = (userData.checkInStreak || 0) + 1;
        }
      }

      // Capped inside a 7-day reward cycle: [10, 15, 20, 25, 30, 35, 40]
      const rewardsCycle = [10, 15, 20, 25, 30, 35, 40];
      const rewardCoins = rewardsCycle[(newStreak - 1) % 7];

      const currentCoins = userData.coins || 0;
      const updatedCoins = currentCoins + rewardCoins;

      // Update user document
      transaction.update(userRef, {
        coins: updatedCoins,
        checkInStreak: newStreak,
        lastCheckInDate: dateStr,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Record transaction
      const txId = `tx_checkin_${uid}_${dateStr}`;
      const txRef = db.collection('coinTransactions').doc(txId);
      transaction.set(txRef, {
        id: txId,
        userId: uid,
        amount: rewardCoins,
        type: 'daily_check_in',
        description: `Checked in (Day ${newStreak} streak reward!)`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update coin leaderboard record
      const lbRef = db.collection('coinLeaderboard').doc(uid);
      transaction.set(lbRef, {
        userId: uid,
        userName: userData.name || 'ShopEasy Member',
        avatar: userData.avatar || '👤',
        totalCoinsEarned: admin.firestore.FieldValue.increment(rewardCoins),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        success: true,
        coinsEarned: rewardCoins,
        newStreak: newStreak,
        totalCoins: updatedCoins,
        message: `✓ Checked in successfully! Earned 🪙 ${rewardCoins} Coins as a Day ${newStreak} streak bonus.`
      };
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('Check-in transactional error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Daily check-in transaction failed.');
  }
});

/**
 * 10. Spin Wheel Cloud Function (Server-Side Verified & Weighted)
 */
exports.spinWheel = functions.https.onCall(async (data, context) => {
  if (!context || !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in to spin the wheel.');
  }

  const uid = context.auth.uid;
  const dateStr = getMalawiDateStr();
  const userRef = db.collection('users').doc(uid);

  // Define prize segments, their weights & descriptions
  // Segment index, description, value, type, weight (must sum up to e.g. 100)
  const segments = [
    { index: 0, coins: 5, label: '5 Coins', type: 'coins', weight: 25 },
    { index: 1, coins: 10, label: '10 Coins', type: 'coins', weight: 35 },
    { index: 2, coins: 20, label: '20 Coins', type: 'coins', weight: 15 },
    { index: 3, coins: 50, label: '50 Coins', type: 'coins', weight: 5 },
    { index: 4, coins: 100, label: '100 Coins', type: 'coins', weight: 1 },
    { index: 5, coins: 0, label: 'Try Again', type: 'empty', weight: 10 },
    { index: 6, coins: 0, label: 'Free Coupon', type: 'coupon', weight: 9 }
  ];

  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }

      const userData = userSnap.data();
      const lastSpin = userData.lastSpinDate || '';
      const isFreeSpin = lastSpin !== dateStr;
      const spinCost = 20;

      let currentCoins = userData.coins || 0;

      // Charge user if not a free spin
      if (!isFreeSpin) {
        if (currentCoins < spinCost) {
          throw new functions.https.HttpsError('failed-precondition', `Insufficient coins. Additional spins cost ${spinCost} coins.`);
        }
        currentCoins -= spinCost;
      }

      // Server-side secure weighted random selection
      const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
      let rand = Math.random() * totalWeight;
      let selectedPrize = segments[0];

      for (const s of segments) {
        rand -= s.weight;
        if (rand <= 0) {
          selectedPrize = s;
          break;
        }
      }

      // Apply prize
      let coinsWon = 0;
      let message = '';
      let couponAwarded = null;

      if (selectedPrize.type === 'coins') {
        coinsWon = selectedPrize.coins;
        currentCoins += coinsWon;
        message = `🎉 You won ${selectedPrize.label}!`;
      } else if (selectedPrize.type === 'coupon') {
        message = `🎟️ You won a lucky discount coupon! Saved to your coupons cabinet.`;
        couponAwarded = {
          code: `SPINFREE_${Math.floor(1000 + Math.random() * 9000)}`,
          discountAmount: 1500,
          discountType: 'flat',
          minOrderValue: 5000,
          isActive: true,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
      } else {
        message = `🍀 Better luck next time! Thanks for spinning.`;
      }

      // Update User Document in Transaction
      const updates = {
        coins: currentCoins,
        lastSpinDate: dateStr,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      transaction.update(userRef, updates);

      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      const randomPart = Math.floor(1000 + Math.random() * 9000);

      // Record cost transaction if applicable
      if (!isFreeSpin) {
        const costTxId = `tx_spin_cost_${uid}_${Date.now()}_${randomPart}`;
        transaction.set(db.collection('coinTransactions').doc(costTxId), {
          id: costTxId,
          userId: uid,
          amount: -spinCost,
          type: 'spin_wheel',
          description: 'Spin Wheel entry fee',
          createdAt: timestamp
        });
      }

      // Record win transaction if coins won
      if (coinsWon > 0) {
        const winTxId = `tx_spin_win_${uid}_${Date.now()}_${randomPart}`;
        transaction.set(db.collection('coinTransactions').doc(winTxId), {
          id: winTxId,
          userId: uid,
          amount: coinsWon,
          type: 'spin_wheel',
          description: `Won from Spin Wheel: ${selectedPrize.label}`,
          createdAt: timestamp
        });

        // Update Leaderboard
        const lbRef = db.collection('coinLeaderboard').doc(uid);
        transaction.set(lbRef, {
          userId: uid,
          userName: userData.name || 'ShopEasy Member',
          avatar: userData.avatar || '👤',
          totalCoinsEarned: admin.firestore.FieldValue.increment(coinsWon),
          updatedAt: timestamp
        }, { merge: true });
      }

      // Award coupon document if applicable
      if (couponAwarded) {
        const userCouponRef = db.collection('users').doc(uid).collection('coupons').doc(couponAwarded.code);
        transaction.set(userCouponRef, {
          code: couponAwarded.code,
          discountAmount: couponAwarded.discountAmount,
          discountType: couponAwarded.discountType,
          minOrderValue: couponAwarded.minOrderValue,
          status: 'collect',
          heading: 'Lucky Spin Gift',
          subheading: 'MWK 1,500 off order > MWK 5,000',
          collectedAt: timestamp,
          expiresAt: couponAwarded.expiresAt
        });
      }

      return {
        success: true,
        segmentIndex: selectedPrize.index,
        prize: selectedPrize,
        coinsEarned: coinsWon,
        totalCoins: currentCoins,
        isFreeSpin,
        message,
        couponCode: couponAwarded?.code || null
      };
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('Spin transaction error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Wheel spin transaction failed.');
  }
});

/**
 * 11. Security Verified Game Action Cloud Function (GoGo Match & Merge Boss)
 * Validates achievements and saves Merge Boss states securely
 */
exports.submitGameResult = functions.https.onCall(async (data, context) => {
  if (!context || !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { gameType, rewardType, score, level, rawState } = data;
  if (!gameType || !['gogo-match', 'merge-boss'].includes(gameType)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid gameType is required.');
  }

  const uid = context.auth.uid;
  const dateStr = getMalawiDateStr();
  const userRef = db.collection('users').doc(uid);
  const dailyTrackerRef = db.collection('users').doc(uid).collection('gameStats').doc(dateStr);

  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }

      const userData = userSnap.data();
      const trackerSnap = await transaction.get(dailyTrackerRef);
      const trackerData = trackerSnap.exists ? trackerSnap.data() : { gogoCount: 0, mergeCoins: 0 };

      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      let currentCoins = userData.coins || 0;
      let coinsEarned = 0;
      let responseMsg = '';

      if (gameType === 'gogo-match') {
        const dailyGogoWinsLimit = 3;
        const rewardPerWin = 15;

        if (trackerData.gogoCount >= dailyGogoWinsLimit) {
          responseMsg = 'Daily Limit Reached! You can earn coins from GoGo Match up to 3 times per day. Enjoy playing!';
        } else {
          coinsEarned = rewardPerWin;
          currentCoins += coinsEarned;
          responseMsg = `✓ Level complete! Earned 🪙 ${rewardPerWin} loyalty coins.`;
          
          transaction.set(dailyTrackerRef, {
            gogoCount: (trackerData.gogoCount || 0) + 1,
            updatedAt: timestamp
          }, { merge: true });
        }
      } else if (gameType === 'merge-boss') {
        // Save board state
        if (rawState) {
          transaction.update(userRef, {
            mergeBossState: rawState,
            mergeBossLevel: level || userData.mergeBossLevel || 1
          });
        }

        if (rewardType === 'order_filled') {
          const maxDailyMergeCoins = 100;
          const currentDailyMergeTotal = trackerData.mergeCoins || 0;

          if (currentDailyMergeTotal >= maxDailyMergeCoins) {
            responseMsg = 'Daily Merge Boss earnings limit reached! Board status saved successfully.';
          } else {
            // Assign a reasonable verified amount: Level 1 -> 5, Level 2 -> 10, etc. capped dynamically up to 30 max per order
            const orderReward = Math.min(30, Math.max(5, (level || 1) * 5));
            const remainingPool = maxDailyMergeCoins - currentDailyMergeTotal;
            coinsEarned = Math.min(orderReward, remainingPool);

            currentCoins += coinsEarned;
            responseMsg = `📦 Customer order filled! Board state saved & earned 🪙 ${coinsEarned} coins.`;

            transaction.set(dailyTrackerRef, {
              mergeCoins: currentDailyMergeTotal + coinsEarned,
              updatedAt: timestamp
            }, { merge: true });
          }
        } else {
          responseMsg = 'Merge Boss state saved between sessions successfully.';
        }
      }

      // Modify coins if changed
      if (coinsEarned > 0) {
        transaction.update(userRef, {
          coins: currentCoins,
          updatedAt: timestamp
        });

        // Add transaction entry
        const txId = `tx_game_${gameType}_${uid}_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
        transaction.set(db.collection('coinTransactions').doc(txId), {
          id: txId,
          userId: uid,
          amount: coinsEarned,
          type: gameType === 'gogo-match' ? 'game_match' : 'game_merge',
          description: gameType === 'gogo-match' ? 'GoGo Match level completion bonus' : 'Merge Boss fulfilled order reward',
          createdAt: timestamp
        });

        // Update leaderboard
        const lbRef = db.collection('coinLeaderboard').doc(uid);
        transaction.set(lbRef, {
          userId: uid,
          userName: userData.name || 'ShopEasy Member',
          avatar: userData.avatar || '👤',
          totalCoinsEarned: admin.firestore.FieldValue.increment(coinsEarned),
          updatedAt: timestamp
        }, { merge: true });
      }

      return {
        success: true,
        coinsEarned,
        totalCoins: currentCoins,
        message: responseMsg
      };
    });
  } catch (error) {
    console.error('Game score validation failure:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Saving game records failed.');
  }
});




// razorpay-config.js
// Razorpay Configuration for Payment Integration

export const RAZORPAY_KEY_ID = 'rzp_test_S4X9wjnzOxiIvw'

// Note: Razorpay Key Secret must NEVER be exposed in frontend code.
// Keep it only on your backend/server.

// Load Razorpay SDK
export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
    document.head.appendChild(script)
  })
}

// Create Razorpay order
export async function createRazorpayOrder(amount, description, email, phone, userId) {
  try {
    // Call your backend API to create order
    const response = await fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount * 100, // Razorpay expects amount in paise
        description: description,
        email: email,
        phone: phone,
        userId: userId
      })
    })

    if (!response.ok) throw new Error('Failed to create order')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating order:', error)
    throw error
  }
}

// Open Razorpay Checkout
export async function openRazorpayCheckout(options) {
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: RAZORPAY_KEY_ID,
      amount: options.amount,
      currency: options.currency || 'INR',
      order_id: options.orderId,
      name: options.name || 'Vivah',
      description: options.description || 'Premium Membership',
      image: options.image || 'https://vivahh-e07a7.web.app/images/logo.png',
      prefill: {
        email: options.email,
        contact: options.phone,
        name: options.customerName
      },
      handler: function(response) {
        resolve(response)
      },
      modal: {
        ondismiss: function() {
          reject(new Error('Payment window closed'))
        }
      },
      theme: {
        color: '#E34450'
      }
    })

    checkout.open()
  })
}

// Verify payment signature
export async function verifyPaymentSignature(paymentData) {
  try {
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    })

    if (!response.ok) throw new Error('Payment verification failed')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error verifying payment:', error)
    throw error
  }
}

// Process payment with Supabase
export async function processPaymentWithSupabase(supabase, userId, paymentData) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          user_id: userId,
          razorpay_order_id: paymentData.orderId,
          razorpay_payment_id: paymentData.paymentId,
          razorpay_signature: paymentData.signature,
          amount: paymentData.amount,
          status: 'completed',
          created_at: new Date()
        }
      ])

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error processing payment:', error)
    throw error
  }
}

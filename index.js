export default {
  async fetch(request, env) {
    // 1. CORS Headers
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, X-Cal-Api-Key",
        },
      });
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
      // 2. Authentication
      const userApiKey = request.headers.get('X-Cal-Api-Key');
      if (!userApiKey) return new Response(JSON.stringify({ error: 'Missing X-Cal-Api-Key' }), { status: 401 });

      const data = await request.json();
      const action = data.action; 

      // ---------------------------------------------------------
      // ACTION: FIND BOOKINGS (The new part)
      // ---------------------------------------------------------
      if (action === 'find_bookings') {
        const userEmail = data.email;
        if (!userEmail) throw new Error("Missing 'email' parameter.");

        // Fetch upcoming bookings (limit to 100 to save bandwidth)
        const calUrl = `https://api.cal.com/v2/bookings?status=upcoming&take=100`;
        
        const calResponse = await fetch(calUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userApiKey}`,
            'cal-api-version': '2024-08-13'
          }
        });

        const result = await calResponse.json();
        
        // Cal.com returns { status: "success", data: { bookings: [...] } }
        // We need to drill down to the bookings array
        const allBookings = result.data?.bookings || result.data || [];

        // FILTER: Find bookings where this email is an attendee
        const validBookings = allBookings.filter(booking => {
            // Check if user is the main attendee
            const attendees = booking.attendees || [];
            return attendees.some(att => att.email.toLowerCase() === userEmail.toLowerCase());
        });

        // SIMPLIFY: Return only what the AI needs to speak
        const simplifiedList = validBookings.map(b => ({
            uid: b.uid,
            title: b.title,
            startTime: b.start, // ISO Format: 2025-11-23T14:00:00Z
            status: b.status
        }));

        return new Response(JSON.stringify({ 
            count: simplifiedList.length, 
            bookings: simplifiedList 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // ---------------------------------------------------------
      // ACTION: CANCEL BOOKING (The existing part)
      // ---------------------------------------------------------
      if (action === 'cancel_booking') {
        const bookingUid = data.bookingUid;
        if (!bookingUid) throw new Error("Missing 'bookingUid' parameter.");

        const calUrl = `https://api.cal.com/v2/bookings/${bookingUid}/cancel`;
        
        const calResponse = await fetch(calUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userApiKey}`,
            'Content-Type': 'application/json',
            'cal-api-version': '2024-08-13'
          },
          body: JSON.stringify({
            cancellationReason: data.cancellationReason || "User requested cancellation via Voice AI",
            cancelSubsequentBookings: true
          })
        });

        const result = await calResponse.json();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};
/**
 * Cal Pal Worker v2 - Universal Booking System
 *
 * A Cloudflare Worker that bridges Retell AI Voice Agents and Cal.com API v2.
 * Supports full booking lifecycle: get, create, cancel, reschedule.
 *
 * Actions:
 * - get_all_bookings: Search bookings by email OR phone number
 * - create_booking: Create a new booking with attendee information
 * - cancel_booking: Cancel an existing booking
 * - reschedule_booking: Reschedule an existing booking to a new time
 */

export default {
  async fetch(request, env) {
    // CORS Headers for preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, X-Cal-Api-Key",
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Authentication - Cal.com API key from header
      const userApiKey = request.headers.get('X-Cal-Api-Key');
      if (!userApiKey) {
        return new Response(JSON.stringify({ error: 'Missing X-Cal-Api-Key header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await request.json();
      // Extract action from Retell's nested structure
      const action = data.args?.action || data.action;

      // Common headers for all Cal.com API requests
      const calHeaders = {
        'Authorization': `Bearer ${userApiKey}`,
        'Content-Type': 'application/json',
        'cal-api-version': '2024-08-13'
      };

      // ---------------------------------------------------------
      // ACTION: GET ALL BOOKINGS
      // Enhanced: Supports email AND/OR phone number lookup
      // ---------------------------------------------------------
      if (action === 'get_all_bookings') {
        const params = data.args || data;
        const { email, phoneNumber } = params;

        if (!email && !phoneNumber) {
          throw new Error("Must provide 'email' or 'phoneNumber' parameter.");
        }

        // Build query params - use attendeeEmail filter if available
        const queryParams = new URLSearchParams({
          status: 'upcoming',
          take: '100'
        });

        // Cal.com API supports attendeeEmail filter directly
        if (email) {
          queryParams.append('attendeeEmail', email);
        }

        const calUrl = `https://api.cal.com/v2/bookings?${queryParams.toString()}`;

        const calResponse = await fetch(calUrl, {
          method: 'GET',
          headers: calHeaders
        });

        if (!calResponse.ok) {
          const errorText = await calResponse.text();
          return new Response(JSON.stringify({
            error: `Cal.com API error: ${calResponse.status}`,
            details: errorText
          }), {
            status: calResponse.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const result = await calResponse.json();

        // Cal.com returns { status: "success", data: [...bookings] }
        const allBookings = result.data || [];

        // Filter bookings by email OR phone number
        const validBookings = allBookings.filter(booking => {
          const attendees = booking.attendees || [];
          return attendees.some(att => {
            const emailMatch = email && att.email &&
              att.email.toLowerCase() === email.toLowerCase();
            const phoneMatch = phoneNumber && att.phoneNumber &&
              att.phoneNumber === phoneNumber;
            return emailMatch || phoneMatch;
          });
        });

        // Simplify response for voice AI
        const simplifiedList = validBookings.map(b => ({
          uid: b.uid,
          title: b.title,
          startTime: b.start,
          endTime: b.end,
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
      // ACTION: CREATE BOOKING
      // Universal booking creation for any event type
      // ---------------------------------------------------------
      if (action === 'create_booking') {
        const params = data.args || data;
        const {
          eventTypeId,
          startTime,
          attendeeName,
          attendeeEmail,
          attendeePhone,
          timezone,
          metadata,
          guests,
          lengthInMinutes
        } = params;

        // Validate required parameters
        if (!eventTypeId) throw new Error("Missing 'eventTypeId' parameter.");
        if (!startTime) throw new Error("Missing 'startTime' parameter.");
        if (!attendeeName) throw new Error("Missing 'attendeeName' parameter.");
        if (!attendeePhone) throw new Error("Missing 'attendeePhone' parameter.");

        // Validate E164 phone format
        if (!attendeePhone.match(/^\+[1-9]\d{1,14}$/)) {
          throw new Error("Phone must be in E164 format (e.g., +15551234567)");
        }

        // Auto-generate email from phone if not provided
        const attendeeEmailFinal = attendeeEmail || `${attendeePhone.replace('+', '')}@calpalworker.com`;

        // Build request body for Cal.com
        const bookingBody = {
          start: startTime,
          eventTypeId: parseInt(eventTypeId, 10),
          attendee: {
            name: attendeeName,
            email: attendeeEmailFinal,
            timeZone: timezone || 'UTC'
          }
        };

        // Add optional phone number
        if (attendeePhone) {
          bookingBody.attendee.phoneNumber = attendeePhone;
        }

        // Add optional metadata
        if (metadata && typeof metadata === 'object') {
          bookingBody.metadata = metadata;
        }

        // Add optional guests
        if (guests && Array.isArray(guests)) {
          bookingBody.guests = guests;
        }

        // Add optional length
        if (lengthInMinutes) {
          bookingBody.lengthInMinutes = parseInt(lengthInMinutes, 10);
        }

        const calUrl = 'https://api.cal.com/v2/bookings';

        const calResponse = await fetch(calUrl, {
          method: 'POST',
          headers: calHeaders,
          body: JSON.stringify(bookingBody)
        });

        const result = await calResponse.json();

        if (!calResponse.ok) {
          return new Response(JSON.stringify({
            error: `Cal.com API error: ${calResponse.status}`,
            details: result
          }), {
            status: calResponse.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Simplify response for voice AI
        const bookingData = result.data || result;
        return new Response(JSON.stringify({
          success: true,
          bookingUid: bookingData.uid,
          title: bookingData.title,
          startTime: bookingData.start,
          endTime: bookingData.end,
          status: bookingData.status,
          confirmationMessage: `Booking confirmed for ${bookingData.start}`
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // ---------------------------------------------------------
      // ACTION: CANCEL BOOKING
      // Cancel an existing booking by UID
      // ---------------------------------------------------------
      if (action === 'cancel_booking') {
        const params = data.args || data;
        const { bookingUid, cancellationReason } = params;

        if (!bookingUid) throw new Error("Missing 'bookingUid' parameter.");

        const calUrl = `https://api.cal.com/v2/bookings/${bookingUid}/cancel`;

        const calResponse = await fetch(calUrl, {
          method: 'POST',
          headers: calHeaders,
          body: JSON.stringify({
            cancellationReason: cancellationReason || "User requested cancellation via Voice AI"
          })
        });

        const result = await calResponse.json();

        if (!calResponse.ok) {
          return new Response(JSON.stringify({
            error: `Cal.com API error: ${calResponse.status}`,
            details: result
          }), {
            status: calResponse.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Booking cancelled successfully",
          ...result
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // ---------------------------------------------------------
      // ACTION: RESCHEDULE BOOKING
      // Move an existing booking to a new time
      // ---------------------------------------------------------
      if (action === 'reschedule_booking') {
        const params = data.args || data;
        const { bookingUid, newStartTime, reschedulingReason } = params;

        if (!bookingUid) throw new Error("Missing 'bookingUid' parameter.");
        if (!newStartTime) throw new Error("Missing 'newStartTime' parameter.");

        const calUrl = `https://api.cal.com/v2/bookings/${bookingUid}/reschedule`;

        const rescheduleBody = {
          start: newStartTime
        };

        if (reschedulingReason) {
          rescheduleBody.reschedulingReason = reschedulingReason;
        }

        const calResponse = await fetch(calUrl, {
          method: 'POST',
          headers: calHeaders,
          body: JSON.stringify(rescheduleBody)
        });

        const result = await calResponse.json();

        if (!calResponse.ok) {
          return new Response(JSON.stringify({
            error: `Cal.com API error: ${calResponse.status}`,
            details: result
          }), {
            status: calResponse.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Simplify response for voice AI
        const bookingData = result.data || result;
        return new Response(JSON.stringify({
          success: true,
          bookingUid: bookingData.uid || bookingUid,
          newStartTime: bookingData.start || newStartTime,
          message: `Booking rescheduled to ${bookingData.start || newStartTime}`
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Unknown action
      return new Response(JSON.stringify({
        error: "Unknown action. Supported actions: get_all_bookings, create_booking, cancel_booking, reschedule_booking"
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

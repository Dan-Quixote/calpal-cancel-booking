# 🤖 Cal Pal (CloudFlare) Worker (Retell AI ↔ Cal.com Bridge)

A free, secure, and simple tool to connect your **Retell AI Voice Agents** to your **Cal.com** calendar for complete booking lifecycle management.

## 🧐 What is this and why do I need it?

If you try to connect Retell AI directly to Cal.com for booking operations, it will fail. This is because Cal.com's API v2 has specific requirements that don't match Retell's function calling format.

**"Cal Pal" acts as a intermediary.**

1.  **Retell** sends the data to this Worker.
2.  **This Worker** instantly translates it into the correct format for Cal.com API v2.
3.  **Cal.com** processes the booking operation (search, create, cancel, or reschedule).
4.  The result is sent back to your AI agent.

It solves API integration issues without you needing to sign up for paid tools like Zapier, Make, or n8n.

## ✨ Features

- **Search Bookings**: Find upcoming bookings by email OR phone number
- **Create Bookings**: Schedule new appointments
- **Cancel Bookings**: Cancel existing appointments with reason tracking
- **Reschedule Bookings**: Move appointments to new times
- **Phone Number Support**: Search bookings using phone numbers in E.164 format

---

## 🔒 Is it Safe? (Security & Privacy)

**Yes.** This code follows a "Pass-Through" design for maximum privacy:

* **No Data Storage:** This worker is "stateless." It processes your request in milliseconds and immediately forgets it. It does not save your API Keys, customer emails, or booking details to any database.
* **Encrypted:** All data travels securely over HTTPS (the same standard used by banks).
* **Open Source:** The code is public (in `index_v2.js`) so you (or a developer friend) can verify exactly what it does. Nothing is hidden.

---

## ⚙️ Setup Guide


Your worker will be available at `https://calpal-cancel-booking.tight-violet-f167.workers.dev/` (or your custom subdomain).

### Step 2: Configure Retell AI Functions

In your Retell dashboard, create a **Custom Function** for each action you need.

**Important:** For all functions, add this header in Retell's "Headers" section:

| Key | Value |
| :--- | :--- |
| `X-Cal-Api-Key` | `cal_live_xxxxxxxx...` (Your Cal.com API Key) |

### Step 3: Add Function Definitions

For each function, use the **same Worker URL** but different schemas. Find complete schemas in the `retell-schemas/` directory.

#### Function 1: Search Bookings
- **Name:** `get_all_bookings`
- **Description:** Search for upcoming bookings by email or phone number
- **URL:** Your Worker URL
- **Schema:** See `retell-schemas/get_all_bookings.json`

#### Function 2: Cancel Booking
- **Name:** `cancel_booking`
- **Description:** Cancel an existing booking by UID
- **URL:** Your Worker URL
- **Schema:** See `retell-schemas/cancel_booking.json`

#### Function 3: Reschedule Booking
- **Name:** `reschedule_booking`
- **Description:** Reschedule an existing booking to a new time
- **URL:** Your Worker URL
- **Schema:** See `retell-schemas/reschedule_booking.json`

#### Function 4: Create Booking
- **Name:** `create_booking`
- **Description:** Create a new booking/appointment
- **URL:** Your Worker URL
- **Schema:** See `retell-schemas/create_booking.json`

**Note:** All schemas include an `action` field with a `const` value. Retell sends this in a nested `args` structure, which the worker handles automatically.

---

## 🔧 Technical Details

### Request Structure
Retell sends function calls in this format:
```json
{
  "call": { /* call metadata */ },
  "name": "get_all_bookings",
  "args": {
    "action": "get_all_bookings",
    "phoneNumber": "+15551234567"
  }
}
```

The worker automatically extracts parameters from `data.args` or falls back to top-level `data` for compatibility.

### Cal.com API Version
This worker uses Cal.com API v2 with version header `2024-08-13`. If Cal.com updates their API, you may need to update:
- Booking response structure parsing
- API endpoint URLs
- Required headers

### Phone Number Format
Phone numbers must be in E.164 format (e.g., `+15551234567`). The worker normalizes phone numbers when searching to handle different formats stored in Cal.com.

---

## 📄 License

This project is open-source and available under the MIT License. Feel free to fork and modify it for your own use.
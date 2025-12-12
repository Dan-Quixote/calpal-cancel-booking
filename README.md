# 🤖 Cal Pal (CloudFlare) Worker (Retell AI ↔ Cal.com Bridge)

A free, secure, and simple tool to connect your **Retell AI Voice Agents** to your **Cal.com** calendar.

## 🧐 What is this and why do I need it?

If you try to connect Retell AI directly to Cal.com to cancel bookings, it will fail. This is because Cal.com requires the Booking ID to be part of the website address (URL), but Retell sends it inside the data package (Body). They are speaking different languages.

**"Cal Pal" acts as a translator.**

1.  **Retell** sends the data to this Worker.
2.  **This Worker** instantly translates it into the correct format for Cal.com.
3.  **Cal.com** processes the cancellation or search.
4.  The result is sent back to your AI agent.

It solves the "404 Not Found" errors without you needing to sign up for paid tools like Zapier, Make, or n8n.

---

## 🔒 Is it Safe? (Security & Privacy)

**Yes.** This code follows a "Pass-Through" design for maximum privacy:

* **No Data Storage:** This worker is "stateless." It processes your request in milliseconds and immediately forgets it. It does not save your API Keys, customer emails, or booking details to any database.
* **Encrypted:** All data travels securely over HTTPS (the same standard used by banks).
* **Open Source:** The code is public (in `index.js`) so you (or a developer friend) can verify exactly what it does. nothing is hidden.

---

## ⚙️ Setup Guide (3 Steps)

### Step 1: Create the Cloudflare Worker (Free)
1.  Go to [Cloudflare Workers](https://dash.cloudflare.com/) and sign up (the free tier is plenty).
2.  Click **Create Worker**.
3.  Name it `calpalworker` (or anything you like) and click **Deploy**.
4.  Click **Edit Code**.
5.  Delete the existing "Hello World" code.
6.  Copy the code from the `index.js` file in this repository and paste it in.
7.  Click **Deploy** again.
8.  **Copy your Worker URL** (it will look like `https://calpalworker.your-name.workers.dev`).

### Step 2: Configure Retell AI
In your Retell dashboard, create a **Custom Function** for each tool below.

**Important:** For both functions, scroll down to the **"Headers"** section in Retell and add this single key:

| Key | Value |
| :--- | :--- |
| `X-Cal-Api-Key` | `cal_live_xxxxxxxx...` (Your actual Cal.com API Key) |

*(Note: You do not need to add Content-Type or API-Version headers; the Worker handles those for you automatically!)*

### Step 3: Copy these Function Definitions

#### Function 1: Find Bookings
*Name this function `get_all_bookings`. This finds the booking before cancelling it.*

* **Function URL:** Paste your Cloudflare Worker URL.
* **Parameters:** Copy/Paste this JSON:

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "const": "find_bookings",
      "description": "Fixed action identifier for the worker."
    },
    "email": {
      "type": "string",
      "description": "The email address of the attendee to find bookings for."
    }
  },
  "required": [
    "action",
    "email"
  ]
}
```

#### Function 2: Cancel Booking
*Name this function `cancel_booking`. This executes the cancellation.*

* **Function URL:** Paste your Cloudflare Worker URL (same as above).
* **Parameters:** Copy/Paste this JSON:

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "const": "cancel_booking",
      "description": "Fixed action identifier for the worker."
    },
    "cancellationReason": {
      "type": "string",
      "description": "The reason for cancellation (e.g., 'User requested')."
    },
    "bookingUid": {
      "type": "string",
      "description": "The unique bookingUid of the booking to cancel (retrieved from get_all_bookings)."
    }
  },
  "required": [
    "action",
    "bookingUid"
  ]
}
```
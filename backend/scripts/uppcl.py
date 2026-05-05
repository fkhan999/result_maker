"""
UPPCL Bill Extraction - Cloud-Native GitHub Actions Scraper
No browser required. Supabase-powered with Auto-Heal key refresh.
"""
import requests
import json
import base64
import os
import re
import sys
import logging
from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Util.Padding import pad, unpad
from Crypto.Hash import SHA1
from datetime import datetime, timezone, timedelta
import concurrent.futures
import threading
from supabase import create_client, Client
from dotenv import load_dotenv

# Load local environment variables if .env exists
load_dotenv()


ist = timezone(timedelta(hours=5, minutes=30))

# Full District to DISCOM Mapping
DISTRICT_MAP = {
    "agra": "DVVNL", "aligarh": "DVVNL", "ambedkar nagar": "MVVNL", "amethi": "MVVNL", "amroha": "PVVNL",
    "auraiya": "DVVNL", "ayodhya": "MVVNL", "azamgarh": "PUVNL", "bagpat": "PVVNL", "bahraich": "MVVNL",
    "ballia": "PUVNL", "balrampur": "MVVNL", "banda": "DVVNL", "barabanki": "MVVNL", "bareilly": "MVVNL",
    "basti": "PUVNL", "bijnor": "PVVNL", "budaun": "MVVNL", "bulandshahr": "PVVNL", "chandauli": "PUVNL",
    "chitrakoot": "DVVNL", "deoria": "PUVNL", "etah": "DVVNL", "etawah": "DVVNL", "farrukhabad": "DVVNL",
    "fatehpur": "PUVNL", "firozabad": "DVVNL", "gautam buddha nagar": "PVVNL", "ghaziabad": "PVVNL",
    "ghazipur": "PUVNL", "gonda": "MVVNL", "gorakhpur": "PUVNL", "hamirpur": "DVVNL", "hapur district": "PVVNL",
    "hardoi": "MVVNL", "hathras": "DVVNL", "jalaun": "DVVNL", "jaunpur": "PUVNL", "jhansi": "DVVNL",
    "kannauj": "DVVNL", "kanpur dehat": "DVVNL", "kanpur nagar": "KESCO", "kasganj": "DVVNL", "kaushambi": "PUVNL",
    "kushinagar": "PUVNL", "lakhimpur kheri": "MVVNL", "lalitpur": "DVVNL", "lucknow": "MVVNL", "maharajganj": "PUVNL",
    "mahoba": "DVVNL", "mainpuri": "DVVNL", "mathura": "DVVNL", "mau": "PUVNL", "meerut": "PVVNL", "mirzapur": "PUVNL",
    "moradabad": "PVVNL", "muzaffarnagar": "PVVNL", "pilibhit": "MVVNL", "pratapgarh": "PUVNL", "prayagraj": "PUVNL",
    "raebareli": "MVVNL", "rampur": "PVVNL", "saharanpur": "PVVNL", "sambhal": "PVVNL", "sant kabir nagar": "PUVNL",
    "sant ravidas nagar bhadohi": "PUVNL", "shahjahanpur": "MVVNL", "shamli": "PVVNL", "shravasti": "MVVNL",
    "siddharthnagar": "PUVNL", "sitapur": "MVVNL", "sonbhadra": "PUVNL", "sultanpur": "MVVNL", "unnao": "MVVNL",
    "varanasi": "PUVNL"
}

class UPPCLScraper:
    def __init__(self, silent=False):
        self.silent = silent
        self.lock = threading.Lock()
        
        # Supabase Configuration
        self.supabase_url = os.environ.get("SUPABASE_URL")
        self.supabase_key = os.environ.get("SUPABASE_KEY")
        self.db: Client = None
        if self.supabase_url and self.supabase_key:
            try:
                self.db = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                self.log_msg(f"[ERROR] Supabase Init Failed: {e}")

        self.BASE_URL = "https://consumer.uppcl.org/uppclwss"
        self.ENC_KEY = ""
        self.APP_SVC_KEY = ""
        
        # Load keys from local JSON if available
        if os.path.exists("keys.json"):
            try:
                with open("keys.json", "r") as f:
                    keys = json.load(f)
                    if "ENC_KEY" in keys: self.ENC_KEY = keys["ENC_KEY"]
                    if "APP_SVC_KEY" in keys: self.APP_SVC_KEY = keys["APP_SVC_KEY"]
            except Exception as e:
                self.log_msg(f"[WARN] Could not load keys from keys.json: {e}")
                
        self.ITERATIONS = 1989
        self.KEY_SIZE = 32

    def log_msg(self, msg):
        if not self.silent:
            logging.getLogger("uppcl").info(msg)

    def send_alert(self, msg):
        # Telegram alert
        tg_token = os.environ.get("TELEGRAM_TOKEN")
        tg_chat  = os.environ.get("TELEGRAM_CHAT_ID")
        if tg_token and tg_chat:
            try:
                url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
                response = requests.post(url, json={"chat_id": tg_chat, "text": f"⚠️ *BijliBill Alert*\n\n{msg}", "parse_mode": "Markdown"})
                if response.status_code == 200:
                    self.log_msg("[SUCCESS] Telegram alert sent.")
                else:
                    self.log_msg(f"[ERROR] Failed to send Telegram alert. Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_msg(f"[ERROR] Exception sending Telegram alert: {e}")
        else:
            self.log_msg("[WARN] TELEGRAM_TOKEN or TELEGRAM_CHAT_ID not set. Alert not sent.")

    def refresh_keys(self):
        self.log_msg("[*] Keys potentially outdated. Refreshing from portal bundle...")
        try:
            home = requests.get("https://consumer.uppcl.org/wss/pay_bill_home", timeout=10)
            js_match = re.search(r'src="[^"]*/?(main\.[a-z0-9]+\.js|main\.js)"', home.text)
            if not js_match: return False
            js_url = f"https://consumer.uppcl.org/wss/{js_match.group(1)}"
            js_content = requests.get(js_url, timeout=10).text
            enc_match = re.search(r'responseEncryptionKey:\s*"([^"]+)"', js_content)
            svc_match = re.search(r'appServiceKey:\s*"([^"]+)"', js_content)
            if enc_match and svc_match:
                try:
                    with self.lock:
                        # Update memory state inside lock
                        self.ENC_KEY, self.APP_SVC_KEY = enc_match.group(1), svc_match.group(1)
                        
                        # Persist to local JSON
                        try:
                            with open("keys.json", "w") as f:
                                json.dump({"ENC_KEY": self.ENC_KEY, "APP_SVC_KEY": self.APP_SVC_KEY}, f, indent=4)
                        except Exception as e:
                            self.log_msg(f"[WARN] Failed to save keys to keys.json: {e}")
                except Exception as e:
                    self.log_msg(f"[WARN] Failed to process keys: {e}")
                return True
        except: pass
        return False

    def _encrypt(self, text):
        salt, iv = os.urandom(32), os.urandom(16)
        key = PBKDF2(self.ENC_KEY, salt, dkLen=self.KEY_SIZE, count=self.ITERATIONS, hmac_hash_module=SHA1)
        cipher = AES.new(key, AES.MODE_CBC, iv=iv)
        ct = cipher.encrypt(pad(text.encode(), 16))
        return salt.hex() + iv.hex() + base64.b64encode(ct).decode()

    def _decrypt(self, enc):
        salt, iv, ct = bytes.fromhex(enc[:64]), bytes.fromhex(enc[64:96]), base64.b64decode(enc[96:])
        key = PBKDF2(self.ENC_KEY, salt, dkLen=self.KEY_SIZE, count=self.ITERATIONS, hmac_hash_module=SHA1)
        cipher = AES.new(key, AES.MODE_CBC, iv=iv)
        return unpad(cipher.decrypt(ct), 16).decode()

    def call_api(self, endpoint, payload, retry=True):
        encrypted = self._encrypt(json.dumps(payload))
        headers = {"Content-Type": "application/json", "appServiceKey": self.APP_SVC_KEY}
        try:
            resp = requests.post(f"{self.BASE_URL}{endpoint}", json={"_cdata": encrypted}, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("statusMsg") == "Access Denied !!" and retry:
                    if self.refresh_keys(): return self.call_api(endpoint, payload, False)
                if "_cdata" in data:
                    try: return json.loads(self._decrypt(data["_cdata"]))
                    except:
                       if retry and self.refresh_keys(): return self.call_api(endpoint, payload, False)
                return data
            elif retry:
                if self.refresh_keys(): return self.call_api(endpoint, payload, False)
        except:
            if retry and self.refresh_keys(): return self.call_api(endpoint, payload, False)
        return None

    def get_data(self, account_no, district_name):
        self.log_msg(f"[INFO] Fetching {account_no} in {district_name}...")
        discom = DISTRICT_MAP.get(district_name.lower(), "PUVNL")
        res = self.call_api("/v2/InstaPayment/GetPayBillDetails", {"kno": account_no, "discomName": discom})
        if not res or "PayBillHomeDTO" not in res: return {"error": res.get("statusMsg") if res else "No response"}
        data = res["PayBillHomeDTO"]
        details = data.get("customerDetailsDTO", {})
        now = datetime.now(ist)
        result = {
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "timestamp_iso": now.isoformat(),
            "name": details.get("name"),
            "account_no": details.get("kno"),
            "due_amount": details.get("dueAmount"),
            "type": details.get("typeOfConnection") or "SMPREPAID",
            "address": details.get("currentAddress", "").replace("$", " ").replace("FalseAccount Is Not Eligible For Bijli Bill Rahat Yojna 2025", "").strip(),
            "last_payment_amount": details.get('paymentMade'),
            "last_payment_date": details.get('paymentDate'),
            "prepaid_balance": None
        }
        if details.get("typeOfConnection") == "SMPREPAID":
            prepaid = self.call_api("/v2/InstaPayment/prepaidBalanceEnquiry", {"accountId": details["kno"], "targetSystem": details["ampISP"], "discomName": details["discomName"]})
            if prepaid and "prepaidBalance" in prepaid:
                result["prepaid_balance"] = prepaid.get("prepaidBalance")
            else:
                # If we couldn't get the balance for a prepaid account, return early with error
                # to prevent drawing false conclusions (like fake 100% deductions).
                return {"error": f"Failed to fetch prepaid balance (Server Error)", "account_no": account_no, "timestamp": result["timestamp"]}
        
        # Save to Supabase (replaces CSV history logic)
        changed = self.save_to_supabase(result)
        if not changed:
            # If no change, try to reuse the last timestamp to keep data stability
            last_ts = self.get_last_timestamp(result["account_no"])
            if last_ts:
                result["timestamp"] = last_ts
        
        return result

    def get_last_timestamp(self, account_no):
        if self.db:
            try:
                res = self.db.table("bill_history").select("timestamp").eq("account_no", account_no).order("timestamp", desc=True).limit(1).execute()
                if res.data:
                    return res.data[0].get("timestamp")
            except Exception as e:
                self.log_msg(f"[WARN] Failed to fetch last timestamp from Supabase: {e}")
        return None

    def save_to_supabase(self, data):
        acc_no = data.get("account_no")
        last_data = None
        query_success = False
        
        # 1. Fetch last record for comparison
        if self.db:
            try:
                res = self.db.table("bill_history").select("prepaid_balance, due_amount").eq("account_no", acc_no).order("timestamp", desc=True).limit(1).execute()
                query_success = True
                if res.data and len(res.data) > 0:
                    last_data = res.data[0]
            except Exception as e:
                self.log_msg(f"[WARN] Supabase query failed for {acc_no}: {e}")
                # If query fails, we CANNOT know if it's new or stable. 
                # Abort to prevent duplicate "Initialization" records.
                return False

        # 2. Compare and Calculate
        def get_val(v):
            if v is None or v == "": return 0.0
            try: return float(v)
            except: return 0.0

        curr_bal = get_val(data.get("prepaid_balance"))
        curr_due = get_val(data.get("due_amount"))

        if last_data is None:
            # ONLY initialize if we successfully queried and found nothing
            if query_success:
                self.log_msg(f"[INFO] Initializing new account {acc_no} with balance {curr_bal}")
                data["recharge"] = 0
                data["deduction"] = 0
            else:
                return False
        else:
            last_bal = get_val(last_data.get("prepaid_balance"))
            last_due = get_val(last_data.get("due_amount"))

            # Use epsilon check for floating point stability
            is_same_bal = abs(curr_bal - last_bal) < 0.001
            is_same_due = abs(curr_due - last_due) < 0.001

            if is_same_bal and is_same_due:
                self.log_msg(f"[INFO] Account {acc_no} - Stable state (Bal: {curr_bal}, Due: {curr_due}). No insert needed.")
                return False
            
            self.log_msg(f"[INFO] Change detected for {acc_no}: Bal {last_bal} -> {curr_bal}, Due {last_due} -> {curr_due}")
            
            # Calculate change
            diff = curr_bal - last_bal
            if diff > 0.001:
                data["recharge"] = round(diff, 4)
                data["deduction"] = 0
                self.log_msg(f"[RECHARGE] Account {acc_no} increased by {data['recharge']}")
            elif diff < -0.001:
                data["deduction"] = round(abs(diff), 4)
                data["recharge"] = 0
                self.log_msg(f"[DEDUCTION] Account {acc_no} decreased by {data['deduction']}")
            else:
                data["recharge"] = 0
                data["deduction"] = 0

        # 3. Persist to Supabase
        if self.db:
            try:
                payload = {
                    "account_no": data.get("account_no"),
                    "timestamp": data.get("timestamp_iso"),
                    "name": data.get("name"),
                    "prepaid_balance": data.get("prepaid_balance"),
                    "recharge": data.get("recharge"),
                    "deduction": data.get("deduction"),
                    "due_amount": data.get("due_amount"),
                    "last_payment_amount": data.get("last_payment_amount"),
                    "last_payment_date": data.get("last_payment_date"),
                    "address": data.get("address"),
                    "connection_type": data.get("type"),
                    "raw_data": data
                }
                self.db.table("bill_history").insert(payload).execute()
                self.log_msg(f"[SUCCESS] Data saved to Supabase for {acc_no}")
                
                # Check for low balance alert
                bal = get_val(data.get("prepaid_balance"))
                if bal < 100 and data.get("type") == "SMPREPAID":
                    alert_msg = f"Low Balance for Account {acc_no} ({data.get('name', 'User')})\nBalance: ₹{bal:.2f}\n\nPlease recharge soon!"
                    self.send_alert(alert_msg)

            except Exception as e:
                self.log_msg(f"[ERROR] Supabase Insert Failed for {acc_no}: {e}")
        return True
def print_result(data):
    print("\n" + "═"*60 + "\n  UPPCL BILL EXTRACTION\n" + "═"*60)
    if "error" in data: print(f"  ERROR: {data['error']}")
    else:
        for k, v in data.items():
            if v is not None and k not in ["timestamp_iso", "raw_data"]:
                label = k.replace('_',' ').title()
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    print(f"  {label:<20}: {v:.2f}")
                else:
                    print(f"  {label:<20}: {v}")
    print("═"*60)

def scrape_all_bills():
    IS_JSON = "json" in sys.argv
    scraper = UPPCLScraper(silent=IS_JSON)
    
    ACCOUNTS = []
    
    # Fetch accounts exclusively from Supabase
    if scraper.db:
        try:
            res = scraper.db.table("accounts").select("account_no, district").eq("is_active", True).execute()
            if res.data:
                # De-duplicate accounts (multiple users might track the same account)
                unique_map = {row["account_no"]: row["district"] for row in res.data}
                ACCOUNTS = [{"ACC": acc, "DIST": dist} for acc, dist in unique_map.items()]
                scraper.log_msg(f"[INFO] Fetched {len(res.data)} records ({len(ACCOUNTS)} unique) from Supabase.")
            else:
                scraper.log_msg("[ERROR] No active accounts found in Supabase table.")
                sys.exit(1)
        except Exception as e:
            scraper.log_msg(f"[ERROR] Failed to fetch accounts from Supabase: {e}")
            sys.exit(1)
    else:
        scraper.log_msg("[ERROR] Supabase client not initialized. Check your SUPABASE_URL and SUPABASE_KEY.")
        sys.exit(1)

    
    final_results = {}
    summary = []
    
    # Run in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_acc = {executor.submit(scraper.get_data, acc["ACC"], acc["DIST"]): acc for acc in ACCOUNTS}
        for future in concurrent.futures.as_completed(future_to_acc):
            acc_data = future_to_acc[future]
            acc_no = acc_data["ACC"]
            try:
                res = future.result()
                final_results[acc_no] = res
                
                # Persist JSON per account
                summary.append({
                    "Account": acc_no,
                    "Balance": res.get("prepaid_balance") if res.get("prepaid_balance") is not None else "N/A",
                    "Recharge": res.get("recharge", 0),
                    "Deduction": res.get("deduction", 0),
                    "Status": "Error" if "error" in res else ("Update" if res.get("recharge") or res.get("deduction") else "Stable")
                })
            except Exception as e:
                err_msg = f"Fatal Error: {str(e)}"
                error_dict = {"account_no": acc_no, "error": err_msg, "timestamp": datetime.now(ist).strftime("%Y-%m-%d %H:%M:%S")}
                final_results[acc_no] = error_dict
                scraper.save_to_json(error_dict) # Save error state to individual file too
                summary.append({
                    "Account": acc_no,
                    "Balance": "Error",
                    "Recharge": 0,
                    "Deduction": 0,
                    "Status": "Failed"
                })
                scraper.log_msg(f"[ERROR] Parallel fetch failed for {acc_no}: {e}")

    if IS_JSON:
        print(json.dumps(final_results, sort_keys=True))
    else:
        # Print results individually
        for acc in final_results:
            print_result(final_results[acc])
            
        # Print Summary Table
        print("\n" + "═"*70 + "\n  FINAL SUMMARY\n" + "═"*70)
        print(f"  {'Account':<15} {'Balance':<15} {'Recharge':<12} {'Deduction':<12} {'Status'}")
        print("  " + "─"*68)
        for row in sorted(summary, key=lambda x: x['Account']):
            try:
                bal_val = float(row['Balance'])
                bal = f"{bal_val:.2f}"
            except: bal = str(row['Balance'])
            
            try:
                rch_val = float(row['Recharge'])
                rch = f"{rch_val:.2f}"
            except: rch = str(row['Recharge'])
            
            try:
                ded_val = float(row['Deduction'])
                ded = f"{ded_val:.2f}"
            except: ded = str(row['Deduction'])
            
            print(f"  {row['Account']:<15} {bal:<15} {rch:<12} {ded:<12} {row['Status']}")
        print("═"*70)
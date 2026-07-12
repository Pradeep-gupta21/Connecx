import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from("campaigns")
  .select("id, title, brief, status, category, platform, budget_min, budget_max, deadline, created_at, advertiser_id, profiles:advertiser_id(display_name, avatar_url)")
  .is("deleted_at", null);

if (error) {
  console.error("Query Error:", error);
} else {
  console.log("Query Successful! Retrieved", data.length, "campaigns.");
  console.log("Sample:", data[0]);
}

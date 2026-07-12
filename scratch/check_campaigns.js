import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from("campaigns")
  .select("id, title, status, publication_status, deleted_at");

if (error) {
  console.error("Error fetching campaigns:", error);
} else {
  console.log("Found campaigns:", data);
}

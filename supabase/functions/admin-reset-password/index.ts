// Lets a workspace owner/admin set a new password for another member of a
// workspace they administer, with no email step. Runs server-side because
// it needs the service_role key -- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are injected automatically by Supabase Edge Functions, never sent to the
// client.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { targetUserId, newPassword } = await req.json();
    if (!targetUserId || typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ error: "targetUserId and a newPassword of at least 6 characters are required." }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Caller-scoped client: just to resolve who is calling.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json({ error: "Not signed in." }, 401);
    const callerId = callerData.user.id;

    // Admin client: bypasses RLS, only used for the checks/actions below.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerMemberships, error: membershipError } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", callerId)
      .in("role", ["owner", "admin"]);
    if (membershipError) return json({ error: membershipError.message }, 500);

    const adminWorkspaceIds = (callerMemberships ?? []).map((m) => m.workspace_id);
    if (adminWorkspaceIds.length === 0) {
      return json({ error: "You are not an owner/admin of any workspace." }, 403);
    }

    const { data: sharedMembership, error: sharedError } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", targetUserId)
      .in("workspace_id", adminWorkspaceIds)
      .limit(1)
      .maybeSingle();
    if (sharedError) return json({ error: sharedError.message }, 500);
    if (!sharedMembership) {
      return json({ error: "That user is not in a workspace you administer." }, 403);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (updateError) return json({ error: updateError.message }, 500);

    await admin.from("audit_events").insert({
      workspace_id: sharedMembership.workspace_id,
      actor_id: callerId,
      action: "member.password_reset_by_admin",
      object_type: "user",
      object_id: targetUserId,
      details: {},
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

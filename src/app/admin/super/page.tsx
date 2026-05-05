import { redirect } from "next/navigation";

/**
 * The super-admin landing has been merged into the unified /admin
 * page. Keep this route as a redirect so existing bookmarks, the
 * UserMenu shortcut, and post-sign-up redirect URLs all still work.
 */
export default function SuperAdminPage() {
  redirect("/admin");
}

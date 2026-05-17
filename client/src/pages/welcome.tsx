import { useEffect } from "react";

/**
 * /welcome — retired surface (C-new.6, Option B).
 *
 * The account-first signup flow this page served was superseded by the
 * Stripe-first checkout flow. The page's form depended on
 * POST /api/v2/public/signup, which was removed in C-new.6.
 *
 * The /welcome route is kept alive only so that promo URLs already
 * shared by admins (app.valoxi.ai/welcome?promo=...) still resolve
 * instead of 404ing. It redirects to the marketing site. Full deletion
 * of this file and its route, plus the promo-campaigns.tsx URL repoint,
 * is deferred to Phase G alongside the marketing-site promo work.
 */
export default function WelcomePage() {
  useEffect(() => {
    window.location.replace("https://valoxi.ai/");
  }, []);

  return null;
}

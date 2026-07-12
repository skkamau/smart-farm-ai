import BrandLogo from "./BrandLogo";

export default function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-live="polite" aria-label="Opening Smart Farm AI">
      <div className="splash-content">
        <BrandLogo size="large" iconOnly className="splash-logo justify-center" />
        <h1 className="splash-title">Smart Farm <span>AI</span></h1>
        <p>Manage your farm smarter.</p>
        <div className="splash-progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}

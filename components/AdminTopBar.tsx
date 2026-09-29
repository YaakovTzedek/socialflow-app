'use client';

/**
 * Top bar of the admin area: brand, badge, the way back to the owner's own
 * app, and a way out of "view as customer" if it is still on.
 */
export default function AdminTopBar({ impersonatingName, appHref, children }: { impersonatingName?: string | null; appHref: string; children?: React.ReactNode }) {
  async function backToMyApp() {
    if (impersonatingName) await fetch('/api/admin/impersonate', { method: 'DELETE' }).catch(() => {});
    location.href = appHref;
  }
  return (
    <>
      <div className="sfad-bar">
        <div className="sfad-brand" dir="ltr">Social<span className="sf-grad-text">Flow</span></div>
        <span className="sfad-badge">אזור ניהול</span>
        <a className="sfad-link" href="/he/admin">לקוחות</a>
        <button type="button" className="sfad-link" onClick={backToMyApp}>חזרה לאפליקציה שלי</button>
        {children}
      </div>
      {impersonatingName && (
        <div className="sfad-imp-note">
          אתה עדיין במצב צפייה כ-{impersonatingName}. <a href={appHref}>להמשיך לצפות</a>
          {' · '}
          <button type="button" className="sfad-copy" onClick={async () => { await fetch('/api/admin/impersonate', { method: 'DELETE' }); location.reload(); }}>יציאה ממצב צפייה</button>
        </div>
      )}
    </>
  );
}

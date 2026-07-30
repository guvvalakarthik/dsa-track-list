import { X } from "lucide-react";
import { useState } from "react";
import { getSettings, saveSettings } from "../api";
export function SettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const current = getSettings();
  const [apiUrl, setApiUrl] = useState(current.apiUrl);
  const [token, setToken] = useState(current.token);
  const [settingsError, setSettingsError] = useState("");

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><span className="section-kicker">CONNECTION</span><h3>Tracker settings</h3></div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <label>
          FastAPI URL
          <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="http://localhost:8000" />
        </label>
        <label>
          Personal tracker token
          <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Leave blank for local development" />
        </label>
        <p>Use the same URL and token in the browser extension. Tokens are kept only for this browser session.</p>
        {settingsError && <p className="checker-error">{settingsError}</p>}
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={() => {
            try {
              saveSettings(apiUrl, token);
              onSaved();
            } catch (err) {
              setSettingsError(err instanceof Error ? err.message : "Invalid API URL");
            }
          }}>Save connection</button>
        </div>
      </div>
    </div>
  );
}

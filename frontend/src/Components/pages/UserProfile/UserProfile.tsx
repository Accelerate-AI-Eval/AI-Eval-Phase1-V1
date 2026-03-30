import {
  Ban,
  LogOutIcon,
  Settings,
  User,
  Shield,
  Loader2,
  UserCircle,
  LockKeyhole,
  Mail,
  CircleX,
  CircleArrowUp,
  Eye,
  EyeOff,
  Landmark,
  UserStar,
} from "lucide-react";
import UserPopup from "../../UI/UserPopup";
import "../../../styles/popovers.css";
import "../VendorOnboarding/StepVendorOnboardingPreview.css";
import "./user_profile.css";
import Button from "../../UI/Button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";

function getSession(key: string): string {
  const v = sessionStorage.getItem(key);
  return v != null ? String(v).trim() : "";
}

function formatRoleForDisplay(role: string | null): string {
  if (!role || typeof role !== "string") return "—";
  return role
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const UserProfile = () => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [settingsUsername, setSettingsUsername] = useState("");
  const [settingsFirstName, setSettingsFirstName] = useState("");
  const [settingsLastName, setSettingsLastName] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const systemRole = sessionStorage.getItem("systemRole");
  const userRole = sessionStorage.getItem("userRole");
  const isVendorOrBuyer =
    systemRole && ["vendor", "buyer"].includes(systemRole.trim().toLowerCase());
  const roleLabel =
    isVendorOrBuyer && userRole?.trim()
      ? formatRoleForDisplay(userRole)
      : formatRoleForDisplay(systemRole);

  const userName = getSession("userName");
  const firstName = getSession("userFirstName");
  const lastName = getSession("userLastName");
  const email = getSession("userEmail");
  const organizationName = getSession("organizationName");
  const displayName =
    userName || [firstName, lastName].filter(Boolean).join(" ") || email || "—";

  const BASE_URL = import.meta.env.VITE_BASE_URL;

  const LOGOUT_SPINNER_MIN_MS = 2500; // 2.5 seconds so spinner is visible 2–3s

  // When Settings popup opens, fetch current user so form shows latest details without refresh
  useEffect(() => {
    if (!showSettingsPopup) return;
    const token = sessionStorage.getItem("bearerToken");
    if (!token) return;
    fetch(`${BASE_URL}/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.user_name != null) {
          setSettingsUsername(String(data.user_name));
          sessionStorage.setItem("userName", String(data.user_name));
        }
        if (data?.user_first_name != null) {
          setSettingsFirstName(String(data.user_first_name));
          sessionStorage.setItem("userFirstName", String(data.user_first_name));
        }
        if (data?.user_last_name != null) {
          setSettingsLastName(String(data.user_last_name));
          sessionStorage.setItem("userLastName", String(data.user_last_name));
        }
        if (data?.email != null)
          sessionStorage.setItem("userEmail", String(data.email));
      })
      .catch(() => {});
  }, [showSettingsPopup]);

  const handleSettingsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSettingsError("");
    const newPass = settingsNewPassword.trim();
    const confirmPass = settingsConfirmPassword.trim();
    if (newPass || confirmPass) {
      if (newPass.length < 6) {
        setSettingsError("New password must be at least 6 characters.");
        return;
      }
      if (newPass !== confirmPass) {
        setSettingsError("New password and confirm password do not match.");
        return;
      }
    }
    const user_name = settingsUsername.trim() || null;
    const user_first_name = settingsFirstName.trim() || null;
    const user_last_name = settingsLastName.trim() || null;
    const usernameUnchanged = settingsUsername.trim() === (userName || "");
    const firstNameUnchanged = settingsFirstName.trim() === (firstName || "");
    const lastNameUnchanged = settingsLastName.trim() === (lastName || "");
    if (usernameUnchanged && firstNameUnchanged && lastNameUnchanged && !newPass) {
      setSettingsError(
        "At least one editable field is required to update.",
      );
      return;
    }
    if (user_name === null && user_first_name === null && user_last_name === null && !newPass) {
      setSettingsError("Enter a value for username, first name, last name, and/or new password.");
      return;
    }
    setSettingsSaving(true);
    try {
      const token = sessionStorage.getItem("bearerToken");
      const res = await fetch(`${BASE_URL}/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_name: user_name ?? undefined,
          user_first_name: user_first_name ?? undefined,
          user_last_name: user_last_name ?? undefined,
          newPassword: newPass || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const u = data.user;
        if (u) {
          if (u.user_name != null)
            sessionStorage.setItem("userName", String(u.user_name));
          if (u.user_first_name != null)
            sessionStorage.setItem("userFirstName", String(u.user_first_name));
          if (u.user_last_name != null)
            sessionStorage.setItem("userLastName", String(u.user_last_name));
          if (u.email != null)
            sessionStorage.setItem("userEmail", String(u.email));
        }
        window.dispatchEvent(
          new CustomEvent("userProfileUpdated", { detail: u ?? {} }),
        );
        toast.success(data.message ?? "Settings saved.");
        setShowSettingsPopup(false);
        setSettingsNewPassword("");
        setSettingsConfirmPassword("");
      } else {
        setSettingsError(data.message ?? "Failed to update settings.");
      }
    } catch (err) {
      console.error(err);
      setSettingsError("Something went wrong. Please try again.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const logout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingOut(true);
    const startTime = Date.now();

    const token = sessionStorage.getItem("bearerToken");

    try {
      const response = await fetch(`${BASE_URL}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result) {
          sessionStorage.removeItem("bearerToken");
          sessionStorage.removeItem("userEmail");
          sessionStorage.removeItem("userRole");
          sessionStorage.removeItem("userId");
          sessionStorage.removeItem("systemRole");
          sessionStorage.removeItem("user_signup_completed");
          sessionStorage.removeItem("user_onboarding_completed");
          // Keep spinner visible for at least 2–3 seconds before redirecting
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, LOGOUT_SPINNER_MIN_MS - elapsed);
          await new Promise((r) => setTimeout(r, remaining));
          navigate("/login");
          return;
        }
      }
    } catch (err) {
      console.log("Request failed: ", err);
    }

    // Ensure spinner shows for at least 2–3s before re-enabling button on error
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, LOGOUT_SPINNER_MIN_MS - elapsed);
    await new Promise((r) => setTimeout(r, remaining));
    setIsLoggingOut(false);
  };

  return (
    <>
      <UserPopup className="user_popup">
        <div className="user_popup_account_header">
          <UserCircle
            size={18}
            className="user_popup_account_icon"
            aria-hidden
          />
          <h5 className="user_popup_account_title">Account</h5>
        </div>

        <ul>
          <li className="user_popup_role">
            <Shield size={14} aria-hidden />
            <span className="user_popup_role_label">Role</span>
            <span className="user_popup_role_value">{roleLabel}</span>
          </li>
          <li
            role="button"
            tabIndex={0}
            onClick={() => setShowProfilePopup(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowProfilePopup(true);
              }
            }}
          >
            <span>
              <User />
            </span>
            <span>Profile</span>
          </li>
          <li
            role="button"
            tabIndex={0}
            onClick={() => {
              setShowSettingsPopup(true);
              setSettingsUsername(userName || "");
              setSettingsFirstName(firstName || "");
              setSettingsLastName(lastName || "");
              setSettingsNewPassword("");
              setSettingsConfirmPassword("");
              setSettingsError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowSettingsPopup(true);
                setSettingsUsername(userName || "");
                setSettingsFirstName(firstName || "");
                setSettingsLastName(lastName || "");
                setSettingsNewPassword("");
                setSettingsConfirmPassword("");
                setSettingsError("");
              }
            }}
          >
            <span>
              <Settings />
            </span>
            <span>Settings</span>
          </li>
        </ul>

        <Button
          className={`logout_btn ${isLoggingOut ? "auth_btn_loading" : ""}`}
          onClick={logout}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
        >
          {isLoggingOut ? (
            <>
              <Loader2
                className="auth_spinner"
                size={18}
                color="white"
                aria-hidden
              />
              Logging out…
            </>
          ) : (
            <>
              <span>
                <LogOutIcon color="white" />
              </span>
              Logout
            </>
          )}
        </Button>
      </UserPopup>

      {showProfilePopup && (
        <div
          className="profile_modal_overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile_modal_title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProfilePopup(false);
          }}
        >
          <div
            className="profile_modal_content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile_modal_header">
              <h2 id="profile_modal_title" className="profile_modal_title">
                User Profile Details
              </h2>
              <button
                type="button"
                className="modal_close_btn"
                onClick={() => setShowProfilePopup(false)}
                aria-label="Close profile"
              >
                <CircleX size={20} />
              </button>
            </div>
            <div className="profile_modal_body profile_modal_preview">
              <div className="profile_form_sections">
                <section className="profile_form_section">
                  <div className="settings_form">
                    <div className="settings_form_row">
                      <div className="settings_form_group">
                        <label htmlFor="profile_username">
                          <User size={16} aria-hidden />
                          User name
                        </label>
                        <input
                          id="profile_username"
                          type="text"
                          className="settings_input settings_input_readonly"
                          value={userName || "—"}
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                      <div className="settings_form_group">
                        <label htmlFor="profile_email">
                          <Mail size={16} aria-hidden />
                          Email
                        </label>
                        <input
                          id="profile_email"
                          type="text"
                          className="settings_input settings_input_readonly"
                          value={email || "—"}
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                    </div>
                    <div className="settings_form_row">
                      <div className="settings_form_group">
                        <label htmlFor="profile_first_name">
                          <User size={16} aria-hidden />
                          First name
                        </label>
                        <input
                          id="profile_first_name"
                          type="text"
                          className="settings_input settings_input_readonly"
                          value={firstName || "—"}
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                      <div className="settings_form_group">
                        <label htmlFor="profile_last_name">
                          <User size={16} aria-hidden />
                          Last name
                        </label>
                        <input
                          id="profile_last_name"
                          type="text"
                          className="settings_input settings_input_readonly"
                          value={lastName || "—"}
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                    </div>
                    <div className="settings_form_row">
                      <div className="settings_form_group">
                        <label htmlFor="profile_organization">
                          <Landmark size={16} aria-hidden />
                          Organization
                        </label>
                        <input
                          id="profile_organization"
                          type="text"
                          className="settings_input settings_input_readonly"
                          value={organizationName || "—"}
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                      <div className="settings_form_group">
                        <label htmlFor="profile_role">
                          <UserStar size={16} aria-hidden />
                          Role
                        </label>
                        <input
                          id="profile_role"
                          type="text"
                          className="settings_input settings_input_readonly"
                          value={roleLabel}
                          readOnly
                          aria-readonly="true"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              <div className="profile_modal_footer profile_modal_footer_center">
                <Button
                  type="button"
                  className="orgCancelBtn"
                  onClick={() => setShowProfilePopup(false)}
                  aria-label="Close profile"
                >
                  <CircleX size={16} aria-hidden />
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettingsPopup && (
        <div
          className="profile_modal_overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings_modal_title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !settingsSaving)
              setShowSettingsPopup(false);
          }}
        >
          <div
            className="profile_modal_content settings_modal_content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile_modal_header">
              <div>
                <h2 id="settings_modal_title" className="profile_modal_title">
                  User Settings
                </h2>
                <p className="userhelptext">
                  To change other details contact Admin
                </p>
              </div>

              <button
                type="button"
                className="modal_close_btn"
                onClick={() => !settingsSaving && setShowSettingsPopup(false)}
                aria-label="Close settings"
                disabled={settingsSaving}
              >
                <CircleX size={20} />
              </button>
            </div>
            <div className="profile_modal_body">
              <form onSubmit={handleSettingsSubmit} className="settings_form">
                <div className="settings_form_row">
                  <div className="settings_form_group">
                    <label htmlFor="settings_user_email">
                      <Mail size={16} aria-hidden />
                      User email
                    </label>
                    <input
                      id="settings_user_email"
                      type="text"
                      className="settings_input settings_input_readonly"
                      value={email || ""}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                  <div className="settings_form_group">
                    <label htmlFor="settings_username">
                      <User size={16} aria-hidden />
                      Username
                    </label>
                    <input
                      id="settings_username"
                      type="text"
                      className="settings_input"
                      value={settingsUsername}
                      onChange={(e) => setSettingsUsername(e.target.value)}
                      placeholder="Enter username (must be unique)"
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="settings_form_row">
                  <div className="settings_form_group">
                    <label htmlFor="settings_organization">
                      <Landmark size={16} aria-hidden />
                      Organization
                    </label>
                    <input
                      id="settings_organization"
                      type="text"
                      className="settings_input settings_input_readonly"
                      value={organizationName || "—"}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                  <div className="settings_form_group">
                    <label htmlFor="settings_role">
                      <UserStar size={16} aria-hidden />
                      Role
                    </label>
                    <input
                      id="settings_role"
                      type="text"
                      className="settings_input settings_input_readonly"
                      value={roleLabel || "—"}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                </div>
                <div className="settings_form_row">
                  <div className="settings_form_group">
                    <label htmlFor="settings_first_name">
                      <User size={16} aria-hidden />
                      First Name
                    </label>
                    <input
                      id="settings_first_name"
                      type="text"
                      className="settings_input"
                      value={settingsFirstName}
                      onChange={(e) => setSettingsFirstName(e.target.value)}
                      placeholder="Enter first name"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="settings_form_group">
                    <label htmlFor="settings_last_name">
                      <User size={16} aria-hidden />
                      Last Name
                    </label>
                    <input
                      id="settings_last_name"
                      type="text"
                      className="settings_input"
                      value={settingsLastName}
                      onChange={(e) => setSettingsLastName(e.target.value)}
                      placeholder="Enter last name"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="settings_form_row">
                  <div className="settings_form_group">
                    <label htmlFor="settings_new_password">
                      <LockKeyhole size={16} aria-hidden />
                      New password
                    </label>
                    <div className="settings_password_wrap">
                      <input
                        id="settings_new_password"
                        type={showNewPassword ? "text" : "password"}
                        className="settings_input"
                        value={settingsNewPassword}
                        onChange={(e) => setSettingsNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        autoComplete="new-password"
                        minLength={6}
                      />
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => setShowNewPassword((v) => !v)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && setShowNewPassword((v) => !v)
                        }
                        className="passwordVisible"
                        aria-label={
                          showNewPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showNewPassword ? (
                          <Eye size={20} strokeWidth={1.5} aria-hidden />
                        ) : (
                          <EyeOff size={20} strokeWidth={1.5} aria-hidden />
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="settings_form_group">
                    <label htmlFor="settings_confirm_password">
                      <LockKeyhole size={16} aria-hidden />
                      Confirm password
                    </label>
                    <div className="settings_password_wrap">
                      <input
                        id="settings_confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        className="settings_input"
                        value={settingsConfirmPassword}
                        onChange={(e) =>
                          setSettingsConfirmPassword(e.target.value)
                        }
                        placeholder="Confirm password"
                        autoComplete="new-password"
                      />
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && setShowConfirmPassword((v) => !v)
                        }
                        className="passwordVisible"
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showConfirmPassword ? (
                          <Eye size={20} strokeWidth={1.5} aria-hidden />
                        ) : (
                          <EyeOff size={20} strokeWidth={1.5} aria-hidden />
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                {settingsError && (
                  <p className="settings_error">{settingsError}</p>
                )}
                <div className="settings_form_actions">
                  <Button
                    type="button"
                    className="orgCancelBtn"
                    onClick={() =>
                      !settingsSaving && setShowSettingsPopup(false)
                    }
                    disabled={settingsSaving}
                  >
                    <Ban size={16} aria-hidden />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="orgCreateBtn"
                    disabled={settingsSaving}
                    aria-busy={settingsSaving}
                  >
                    {settingsSaving ? (
                      <>
                        Updating…
                        <Loader2
                          size={18}
                          className="auth_spinner"
                          aria-hidden
                        />
                      </>
                    ) : (
                      <>
                        <CircleArrowUp size={16} aria-hidden />
                        Update
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserProfile;

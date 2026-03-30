import { useEffect, useState, useMemo } from "react";
import {
  ArrowRight,
  LockKeyhole,
  Eye,
  EyeOff,
  Mail,
  CheckCircle,
  CircleAlert,
  Loader2,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import "../Login/login.css";
import "./resetPassword.css";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import HeaderForAuth from "../../UI/HeaderForAuth";

interface ResetTokenPayload {
  email?: string;
  purpose?: string;
  exp?: number;
}

const ResetPassword = () => {
  useEffect(() => {
    document.title = "AI Eval Platform | Reset Password";
  }, []);

  const BASE_URL = (import.meta.env.VITE_BASE_URL ?? "").toString().trim();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode<ResetTokenPayload>(token);
    } catch {
      return null;
    }
  }, [token]);

  const emailFromToken = decodedToken?.email ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isVisibleConfirm, setIsVisibleConfirm] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const passwordVisible = () => setIsVisible((prev) => !prev);
  const confirmPasswordVisible = () => setIsVisibleConfirm((prev) => !prev);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!token) {
      setMessage("Invalid or expired reset link.");
      setStatus("error");
      return;
    }

    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setStatus("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`${BASE_URL}/resetPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
          email: (emailFromToken ?? "").toString().trim().toLowerCase(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setStatus("success");
        setMessage(data.message || "Password reset successfully.");
        setTimeout(
          () => navigate("/login", { state: { resetSuccess: true } }),
          2000,
        );
      } else {
        setStatus("error");
        setMessage(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Unable to connect. Please try again later.");
    }
  };

  if (!token || !decodedToken || !emailFromToken) {
    return (
      <div className="authPage">
        <div className="authContent">
          <div className="loginData">
            <div className="loginCred">
              <HeaderForAuth />
              <div className="loginForm">
                <h1 className="loginHeading">Invalid link</h1>
                <div className="authMessage authMessage--error">
                  <CircleAlert
                    className="authMessage__icon"
                    size={16}
                    aria-hidden
                  />
                  <p className="resetError">
                    Invalid or expired reset link. Please use the link from your
                    email or <Link to="/forgotPassword">request a new one</Link>
                    .
                  </p>
                </div>
                <div className="loginBtn">
                  <Link to="/login" className="login-btn">
                    Back to Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="authPage">
        <div className="authContent">
          <div className="loginData">
            <div className="loginCred">
              <HeaderForAuth />
              <div className="loginForm">
                <p className="loginHeading">Reset Password</p>
                <form onSubmit={handleSubmit} autoComplete="off">
                  <p className="loginCaption mailText">
                    Reset your password to regain access to your account.
                  </p>
                  <div className="emailData">
                    <label htmlFor="resetEmail">
                      <span>
                        <Mail width={20} strokeWidth={1.5} />
                      </span>{" "}
                      Account email (from reset link)
                    </label>
                    <input
                      id="resetEmail"
                      type="email"
                      value={emailFromToken}
                      readOnly
                      className="resetMail readOnlyField"
                      tabIndex={-1}
                      aria-readonly
                    />
                  </div>
                  <div className="passwordData">
                    <label htmlFor="newPassword">
                      <span>
                        <LockKeyhole width={20} strokeWidth={1.5} />
                      </span>{" "}
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      type={isVisible ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      maxLength={128}
                      minLength={8}
                      placeholder="At least 8 characters"
                      disabled={status === "loading" || status === "success"}
                    />
                    <span
                      onClick={passwordVisible}
                      className="passwordVisible"
                      aria-hidden
                    >
                      {isVisible ? (
                        <Eye size={20} strokeWidth={1.5} />
                      ) : (
                        <EyeOff size={20} strokeWidth={1.5} />
                      )}
                    </span>
                  </div>
                  <div className="passwordData">
                    <label htmlFor="confirmPassword">
                      <span>
                        <LockKeyhole width={20} strokeWidth={1.5} />
                      </span>{" "}
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      type={isVisibleConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      maxLength={128}
                      placeholder="Confirm new password"
                      disabled={status === "loading" || status === "success"}
                    />
                    <span
                      onClick={confirmPasswordVisible}
                      className="passwordVisible"
                      aria-hidden
                    >
                      {isVisibleConfirm ? (
                        <Eye size={20} strokeWidth={1.5} />
                      ) : (
                        <EyeOff size={20} strokeWidth={1.5} />
                      )}
                    </span>
                  </div>
                  {message && (
                    <div
                      className={
                        status === "success"
                          ? "authMessage authMessage--success"
                          : "authMessage authMessage--error"
                      }
                    >
                      {status === "success" ? (
                        <CheckCircle
                          className="authMessage__icon"
                          size={16}
                          aria-hidden
                        />
                      ) : (
                        <CircleAlert
                          className="authMessage__icon"
                          size={16}
                          aria-hidden
                        />
                      )}
                      <p
                        className={
                          status === "success" ? "resetSuccess" : "resetError"
                        }
                      >
                        {message}
                      </p>
                    </div>
                  )}
                  <div className="loginBtn">
                    <button
                      type="submit"
                      className={`login-btn ${
                        status === "loading" ||
                        status === "success" ||
                        !newPassword ||
                        !confirmPassword
                          ? "disabled_css"
                          : ""
                      } ${status === "loading" ? "auth_btn_loading" : ""}`}
                      disabled={
                        status === "loading" ||
                        status === "success" ||
                        !newPassword ||
                        !confirmPassword
                      }
                      aria-busy={status === "loading"}
                    >
                      {status === "loading" ? (
                        <>
                          Resetting…
                          <Loader2
                            className="auth_spinner"
                            size={20}
                            aria-hidden
                          />
                        </>
                      ) : status === "success" ? (
                        <>
                          Success — redirecting…
                          <span>
                            <ArrowRight width={20} />
                          </span>
                        </>
                      ) : (
                        <>
                          Confirm
                          <span>
                            <ArrowRight width={20} />
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="signinText">
                    Remember your password?{" "}
                    <Link to="/login">
                      <span>Sign in</span>
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;

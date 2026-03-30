import {
  Mail,
  ArrowRight,
  LockKeyhole,
  Eye,
  EyeOff,
  User,
  CheckCircle,
  Loader2,
} from "lucide-react";
import "../Login/login.css";
import "../ResetPassword/resetPassword.css";
import "../../pages/UserProfile/user_profile.css";
import "../../../styles/popovers.css";
import "./signup.css";
import { useEffect, useState } from "react";
import type { SignUpdata } from "../Validations/sign_up_validations";
import {
  useNavigate,
  useSearchParams,
  useParams,
  Link,
} from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import HeaderForAuth from "../../UI/HeaderForAuth";
import Button from "../../UI/Button";

const SignUp = () => {
  useEffect(() => {
    document.title = "AI Eval Platform | Sign Up";
  }, []);
  const BASE_URL = import.meta.env.VITE_BASE_URL;

  const [isVisibleConfirm, setIsVisibleConfirm] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useParams();
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmSignup, setIsConfirmSignup] = useState(false);
  const [onboardingEmailSent, setOnboardingEmailSent] = useState(false);
  const [isError, setIsError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  const decode = (() => {
    if (!token) return null;
    try {
      return jwtDecode<{ email?: string; exp?: number }>(token);
    } catch {
      return null;
    }
  })();

  const decodeEmail = decode?.email ?? "";

  useEffect(() => {
    if (!token) {
      setLinkExpired(true);
      return;
    }
    try {
      const d = jwtDecode<{ exp?: number }>(token);
      if (d.exp != null && d.exp < Date.now() / 1000) {
        setLinkExpired(true);
      }
    } catch {
      setLinkExpired(true);
    }
  }, [token]);

  // After signup success: redirect to sign in only when onboarding email was not sent
  const REDIRECT_DELAY_MS = 5000;
  const LOGIN_PATH = "/login";
  useEffect(() => {
    if (!isConfirmSignup || onboardingEmailSent) return;
    const timer = setTimeout(() => {
      navigate(LOGIN_PATH, { replace: true });
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isConfirmSignup, onboardingEmailSent, navigate]);

  const passwordVisible = () => {
    setIsVisible((prev) => !prev);
  };
  const confirmPasswordVisible = () => {
    setIsVisibleConfirm((prev) => !prev);
  };

  const [signUpFormData, setSignUpFormData] = useState<SignUpdata>({
    email: decodeEmail,
    firstName: "",
    lastName: "",
    userName: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignUpFormData((prev) => ({ ...prev, [name]: value }));
  };

  console.log(signUpFormData);
  const isDisabledBtn =
    Object.values(signUpFormData).some((val) => val.trim() === "") || isLoading;

  const hanldeSubmitSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsError("");
    try {
      const response = await fetch(`${BASE_URL}/signupData/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signUpFormData),
      });
      const result = await response.json();
      if (response.ok) {
        setIsConfirmSignup(true);
        setOnboardingEmailSent(Boolean(result.onboardingEmailSent));
        sessionStorage.setItem("signup_completed", "true");
        if (signUpFormData.email && signUpFormData.newPassword) {
          sessionStorage.setItem(
            "signupEmail",
            signUpFormData.email.trim().toLowerCase(),
          );
          sessionStorage.setItem("signupPassword", signUpFormData.newPassword);
        }
        setSignUpFormData({
          email: decodeEmail,
          firstName: "",
          lastName: "",
          userName: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const msg = result.message ?? "Sign up failed. Please try again.";
        setIsError(msg);
        if (
          response.status === 401 &&
          typeof msg === "string" &&
          msg.toLowerCase().includes("expired")
        ) {
          setLinkExpired(true);
        }
      }
    } catch (error) {
      console.log(error);
      setIsError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (linkExpired) {
    return (
      <div className="authPage">
        <div className="signupContent authContent">
          <div className="signup_page">
            <HeaderForAuth />
            <div className="signup_modal_content">
              <div className="profile_modal_header">
                <p className="loginHeading">Sign up</p>
              </div>
              <div className="profile_modal_body">
                <div className="signup_confirmation_wrapper">
                  <div
                    className="authMessage authMessage--error"
                    style={{ padding: "0", textAlign: "center" }}
                  >
                    <p
                      className="text_signup"
                      style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}
                    >
                      Signup link has expired
                    </p>
                    <p className="text_signup" style={{ margin: 0 }}>
                      This link is valid for 7 days from when it was sent.
                      Please ask your administrator to resend the invite.
                    </p>
                    <p className="text_signup" style={{ marginTop: "1rem" }}>
                      <Link
                        to={LOGIN_PATH}
                        className="login-btn signup_success_signin_btn"
                      >
                        Back to sign in
                      </Link>
                    </p>
                  </div>
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
        <div className="signupContent authContent">
          {/* <h1>hhh</h1> */}
          {isConfirmSignup ? (
            <div className="signup_page">
              <HeaderForAuth />
              <div className="signup_modal_content">
                <div className="profile_modal_body">
                  <div className="signup_confirmation_wrapper">
                    <div className="signup_confirmation_card authMessage authMessage--success">
                      <CheckCircle
                        size={48}
                        aria-hidden
                        className="confirm_onboarding"
                      />
                      <p className="signup_confirmation_title">
                        Your account has been{" "}
                        <span className="sucess_text">successfully activated.</span>
                      </p>
                      {onboardingEmailSent ? (
                        <>
                          <p className="text_signup onboarding_email_sent_text">
                            An email has been sent for onboarding. Please check
                            your inbox and use the link to complete onboarding.
                          </p>
                          <p className="text_signup" style={{ marginTop: "0.5rem" }}>
                            <Link
                              to={LOGIN_PATH}
                              className="login-btn signup_success_signin_btn signup_confirmation_cta"
                            >
                              Sign in
                              <span aria-hidden><ArrowRight width={20} /></span>
                            </Link>{" "}
                            when you have completed onboarding.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="small_text">
                            Redirecting to sign in in a few seconds…
                          </p>
                          <Link
                            to={LOGIN_PATH}
                            className="login-btn signup_success_signin_btn signup_confirmation_cta"
                          >
                            Sign in now
                            <span aria-hidden><ArrowRight width={20} /></span>
                          </Link>
                          <p className="small_text">
                            to continue to your account.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="signup_page">
              <HeaderForAuth />
              <div className="signup_modal_content">
                <div className="profile_modal_header">
                  <p className="loginHeading">Sign up</p>
                </div>
                <div className="profile_modal_body">
                  <p className="loginCaption mailText">
                    Create an account to get started with the AI Eval platform.
                  </p>
                  <form
                    className="settings_form"
                    action=""
                    autoComplete="off"
                    onSubmit={hanldeSubmitSignUp}
                  >
                    <div className="settings_form_row">
                      <div className="settings_form_group">
                        <label htmlFor="signup-email">
                          <Mail width={20} strokeWidth={1.5} />
                          Email
                        </label>
                        <input
                          id="signup-email"
                          className="settings_input settings_input_readonly"
                          type="email"
                          name="email"
                          value={signUpFormData.email}
                          readOnly
                        />
                      </div>
                      <div className="settings_form_group">
                        <label htmlFor="signup-userName">
                          <User width={20} strokeWidth={1.5} />
                          User Name
                        </label>
                        <input
                          id="signup-userName"
                          className="settings_input"
                          type="text"
                          name="userName"
                          value={signUpFormData.userName}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="settings_form_row">
                      <div className="settings_form_group">
                        <label htmlFor="signup-firstName">
                          <User width={20} strokeWidth={1.5} />
                          First Name
                        </label>
                        <input
                          id="signup-firstName"
                          className="settings_input"
                          type="text"
                          name="firstName"
                          value={signUpFormData.firstName}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="settings_form_group">
                        <label htmlFor="signup-lastName">
                          <User width={20} strokeWidth={1.5} />
                          Last Name
                        </label>
                        <input
                          id="signup-lastName"
                          className="settings_input"
                          type="text"
                          name="lastName"
                          value={signUpFormData.lastName}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="settings_form_row">
                      <div className="settings_form_group">
                        <label htmlFor="signup-newPassword">
                          <LockKeyhole width={20} strokeWidth={1.5} />
                          New Password
                        </label>
                        <div className="settings_password_wrap">
                          <input
                            id="signup-newPassword"
                            className="settings_input"
                            type={isVisible ? "text" : "password"}
                            maxLength={16}
                            name="newPassword"
                            value={signUpFormData.newPassword}
                            onChange={handleChange}
                          />
                          <span
                            onClick={passwordVisible}
                            className="passwordVisible"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                              e.key === "Enter" && passwordVisible()
                            }
                            aria-label={
                              isVisible ? "Hide password" : "Show password"
                            }
                          >
                            {isVisible ? (
                              <Eye size={20} strokeWidth={1.5} />
                            ) : (
                              <EyeOff size={20} strokeWidth={1.5} />
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="settings_form_group">
                        <label htmlFor="signup-confirmPassword">
                          <LockKeyhole width={20} strokeWidth={1.5} />
                          Confirm Password
                        </label>
                        <div className="settings_password_wrap">
                          <input
                            id="signup-confirmPassword"
                            className="settings_input"
                            type={isVisibleConfirm ? "text" : "password"}
                            name="confirmPassword"
                            value={signUpFormData.confirmPassword}
                            maxLength={16}
                            onChange={handleChange}
                          />
                          <span
                            onClick={confirmPasswordVisible}
                            className="passwordVisible"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                              e.key === "Enter" && confirmPasswordVisible()
                            }
                            aria-label={
                              isVisibleConfirm
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {isVisibleConfirm ? (
                              <Eye size={20} strokeWidth={1.5} />
                            ) : (
                              <EyeOff size={20} strokeWidth={1.5} />
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isError && <p className="settings_error">{isError}</p>}
                    <div className="settings_form_actions">
                      <Button
                        type="submit"
                        className={`orgCreateBtn ${isDisabledBtn ? "disabled_css" : ""} ${isLoading ? "auth_btn_loading" : ""}`}
                        disabled={isDisabledBtn}
                        aria-busy={isLoading}
                      >
                        {isLoading ? (
                          <>
                            Signing up…
                            <Loader2
                              className="auth_spinner"
                              size={20}
                              aria-hidden
                            />
                          </>
                        ) : (
                          <>
                            Sign Up
                            <ArrowRight width={20} />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SignUp;

import { Outlet } from "react-router-dom";
import { Shield } from "lucide-react";

const LayoutWithoutNav = () => {
  return (
    <>
      {/* <div className="container onBoarding_container">
         <div className="step_form_header welcome_msg_onboarding">
           <div className="logo_sec">
            <Shield className="logo_img" size={40} />
           
          </div>
          <h2>Welcome to AI Eval!</h2>
          <p className="modal_sub_title">Let's set up your account in jusr few steps</p>
        </div>
        <main className="main_container">
          <Outlet />
        </main>
      </div> */}
      <div className="layout_onBoarrding">
        <header className="header_onboarding">
          <div className="logo_sec header_for_auth" aria-label="AI Eval">
            <span>
              <Shield size={24} aria-hidden />
            </span>
            <p>AI Eval Platform</p>
          </div>
          <h2>Welcome to AI Eval!</h2>
          <p className="modal_sub_title">
            Let's set up your account in jusr few steps
          </p>
        </header>

        <div className="container_onBoarding">
          <main className="main_onBoarding">
            <section>
              <Outlet />
            </section>
          </main>
        </div>
      </div>
    </>
  );
};

export default LayoutWithoutNav;

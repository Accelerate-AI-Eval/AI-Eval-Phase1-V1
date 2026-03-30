import React, { useEffect, useState } from "react";
import "./onboarding.css";
import { Store, ChevronRightCircle, Building2, FileCheck } from "lucide-react";
import Button from "../../UI/Button";
import { useNavigate, useParams } from "react-router-dom";
import CardContainerOnBoarding from "../../UI/CardContainerOnBoarding";
import CardOnBoarding from "../../UI/CardOnBoarding";
import  {jwtDecode}  from "jwt-decode";

interface TokenPayload {
  email: string;
  userId: string;
  organizationId?: string;
  exp: number;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [disableBtn, setDisabledBtn] = useState(true);
  const { token } = useParams<{ token: string }>();
useEffect(() => {
  document.title = "AI Eval | Onboarding";

  const activeToken = token || sessionStorage.getItem("onboardingToken");

  if (!activeToken) {
    navigate("/login");
    return;
  }

  try {
    const decoded: TokenPayload = jwtDecode(activeToken);

    if (decoded.exp * 1000 < Date.now()) {
      alert("Token expired. Please login again.");
      sessionStorage.clear();
      navigate("/login");
      return;
    }

    sessionStorage.setItem("onboardingToken", activeToken);
    sessionStorage.setItem("email", decoded.email);
    sessionStorage.setItem("userId", decoded.userId);
    if (decoded.organizationId != null) {
      sessionStorage.setItem("organizationId", String(decoded.organizationId));
    }
  } catch (error) {
    console.error("Invalid token", error);
    alert("Invalid token. Please login again.");
    sessionStorage.clear();
    navigate("/login");
  }
}, [token, navigate]);


  const handleSelection = async () => {
    const activeToken = token || sessionStorage.getItem("onboardingToken");
    if (!activeToken) return;
    const BASE_URL = import.meta.env.VITE_BASE_URL ?? "http://localhost:5003/api/v1";
    if (role === "buyer") {
      try {
        await fetch(`${BASE_URL}/buyerOnboarding/clear-vendor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeToken}`,
          },
        });
      } catch (e) {
        console.error("Clear vendor onboarding failed", e);
      }
      navigate(`/onBoarding/buyerOnboarding/${token}`);
    } else if (role === "vendor") {
      try {
        await fetch(`${BASE_URL}/vendorOnboarding/clear-buyer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeToken}`,
          },
        });
      } catch (e) {
        console.error("Clear buyer onboarding failed", e);
      }
      navigate(`/onBoarding/vendorOnboarding/${token}`);
    }
  };

  // console.log("role",role)

  const handleRole = (val: string) => {
    setRole(val);
    setDisabledBtn(false);
  };

  const aboutOrganization = [
    {
      list: "Create vendor risk assessments",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
    {
      list: "Invite vendors to collaborate",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
    {
      list: "Generate compliance reports",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
    {
      list: "Track vendor relationships",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
  ];

  const aboutVendor = [
    {
      list: "Respond to customer assessments",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
    {
      list: "Create self-attestations",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
    {
      list: "List in vendor directory",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
    {
      list: "Share compliance documentation",
      listIcon: <FileCheck color="#22c55e" size={16} />,
    },
  ];

  return (
    <>
      <CardContainerOnBoarding>
        <CardOnBoarding className="card_section">
          <div>
            {/* <h2>Are you a Buyer or Vendor?</h2> */}
            <h2>How will you use this platform?</h2>
            <p className="modal_sub_title">
              This helps us perosonalize your experience and pre-fill assessment
              fields
            </p>
          </div>
          <div className="card_onboarding">
            <div className="radio-wrapper-22">
              <label className="radio-wrapper" htmlFor="buyer">
                <input
                  type="radio"
                  className="radio-input"
                  name="radio-examples"
                  id="buyer"
                  onClick={() => handleRole("buyer")}
                  checked={role === "buyer"}
                />
                <span className="radio-tile">
                  <span className="radio-icon">
                    {/* <User /> */}
                    <Building2 />
                  </span>
                  <div className="card_one">
                    <div className="radio-label">
                      <span className="title_card">
                        Organization Implementing AI
                      </span>
                      <span className="sub_title_card">
                        Evaluating AI Products
                      </span>
                    </div>
                    <div className="card_para">
                      I need to assess AI vendors and products for risk,
                      compliance, and suitability before implementing them in my
                      organization.
                    </div>
                    <div className="card_list">
                      <ul>
                        {aboutOrganization.map((val, index) => (
                          <li key={index}>
                            <span>{val.listIcon}</span>
                            <span>{val.list}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </span>
              </label>
            </div>
            <div className="radio-wrapper-22">
              <label className="radio-wrapper" htmlFor="example-22">
                <input
                  type="radio"
                  className="radio-input"
                  name="radio-examples"
                  id="example-22"
                  onClick={() => handleRole("vendor")}
                  checked={role === "vendor"}
                />
                <span className="radio-tile">
                  <span className="radio-icon">
                    {/* <User /> */}
                    <Store />
                  </span>
                  <div className="card_one">
                    <div className="radio-label">
                      <span className="title_card">AI Vendor</span>
                      <span className="sub_title_card">
                        Selling AI Products
                      </span>
                    </div>
                    <div className="card_para">
                      I develop or sell AI products and need to demonstrate
                      compliance, security, and trustworthiness to potential
                      customers.
                    </div>
                    <div className="card_list">
                      <ul>
                        {aboutVendor.map((val, index) => (
                          <li key={index}>
                            <span>{val.listIcon}</span>
                            <span>{val.list}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </span>
              </label>
            </div>
          </div>
        </CardOnBoarding>

        <div>
          <Button
            onClick={handleSelection}
            type="button"
            className=" card_continue_btn"
            disabled={disableBtn}
          >
            <span>
              Continue <ChevronRightCircle size={16} />
            </span>
          </Button>
        </div>
      </CardContainerOnBoarding>

      {/* </div> */}
    </>
  );
};

export default Onboarding;

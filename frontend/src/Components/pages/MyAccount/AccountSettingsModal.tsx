import { useEffect } from "react";
import { CircleX } from "lucide-react";
import MyAccount from "./MyAccount";
import "../../../styles/popovers.css";
import "../UserProfile/user_profile.css";

type AccountSettingsModalProps = {
  onClose: () => void;
};

/** My Account content (organization, personal details, password) shown as a popup from the profile menu. */
const AccountSettingsModal = ({ onClose }: AccountSettingsModalProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="profile_modal_overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Account settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="profile_modal_content account_settings_modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile_modal_header account_settings_modal_header">
          <button
            type="button"
            className="modal_close_btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CircleX size={20} />
          </button>
        </div>
        <div className="profile_modal_body">
          <MyAccount hidePageHeader />
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;

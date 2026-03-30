import { Ban, CircleX, Landmark, Plus } from "lucide-react";
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { getOrganizations } from "../../../Context/OrganizationsData";

const CreateOrganization = ({ setIsOrganization }) => {
  const BASE_URL = import.meta.env.VITE_BASE_URL;

  const [isOrganizationName, setIsOrganizationName] = useState("");
  const [isError, setIsError] = useState("");
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const dispatch = useDispatch();
  const { data: organizations } = useSelector((state) => state.organizations);
  const closeNewOrg = () => {
    setIsOrganization(false);
    setIsError("");
  };

  const createOrg = async (e) => {
    e.preventDefault();

    const nameTrimmed = isOrganizationName?.trim() ?? "";
    if (!nameTrimmed) {
      setIsError("Organization field is required");
      return;
    }

    const nameLower = nameTrimmed.toLowerCase();
    const duplicate = (organizations ?? []).some(
      (org) => (org.organizationName ?? "").trim().toLowerCase() === nameLower
    );
    if (duplicate) {
      setIsError("An organization with this name already exists.");
      return;
    }

    const user = sessionStorage.getItem("userId");
    const orgData = { isOrganizationName, user };
    const token = sessionStorage.getItem("bearerToken");

    setIsCreateLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/newOrganization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orgData),
      });
      const result = await response.json();
      if (response.ok) {
        closeNewOrg();
        setIsOrganizationName("");
        toast.success("Organization created successfully");
        dispatch(getOrganizations());
        setIsError("");
      } else {
        setIsError(result.message ?? "Failed to create organization");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network or server error. Please try again.");
    } finally {
      setIsCreateLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="newOrg">
        <div className="newOrgHeading">
          <h2>Create Organization</h2>
          <span onClick={closeNewOrg}>
            <CircleX />
          </span>
        </div>
        <div className="orgDetails">
          <form action="" autoComplete="off" onSubmit={createOrg}>
            <div className="orgName">
              <label htmlFor="orgname">
                <span>
                  <Landmark width={20} />
                </span>
                Organization Name
              </label>
              <input
                type="text"
                value={isOrganizationName}
                onChange={(e) => setIsOrganizationName(e.target.value)}
              />
              {isError && <p className="orgError">{isError}</p>}
            </div>
            <div className="orgBtns">
              <button className="orgCancelBtn" onClick={closeNewOrg}>
                <span>
                  <Ban width={16} />
                </span>
                Cancel
              </button>
              <button
                type="submit"
                className={`orgCreateBtn ${isCreateLoading ? "disabled_css" : ""}`}
                disabled={isCreateLoading}
                aria-busy={isCreateLoading}
              >
                <span>
                  <Plus width={18} />
                </span>
                {isCreateLoading ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateOrganization;

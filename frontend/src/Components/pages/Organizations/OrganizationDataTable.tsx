import { Eye, SquarePen } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import DataTable from "react-data-table-component";
import { useDispatch, useSelector } from "react-redux";
import { getOrganizations } from "../../../Context/OrganizationsData";
import LoadingMessage from "../../UI/LoadingMessage";
import EditOrganization from "./EditOrganization";

const LOADER_MIN_MS = 1500;

const OrganizationDataTable = ({ openPreview, viewOnly = false }) => {
  const [filterText, setFilterText] = React.useState("");
  const [resetPaginationToggle, setResetPaginationToggle] =
    React.useState(false);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useRef(null);

  const dispatch = useDispatch();
  const { data, status } = useSelector((state) => state.organizations);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  // const getOrganizations = async () => {
  //   // console.log("here");
  //   try {
  //     const response = await fetch(
  //       "http://localhost:5003/api/v1/allOrganizations",
  //       {
  //         method: "GET",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //       },
  //     );
  //     // console.log(response)
  //     const result = await response.json()
  //     console.log(result)
  //     if(response.ok){
  //       setTableData(result.data)
  //     }

  //   } catch (error) {
  //     console.log(error)
  //   }
  // };

  useEffect(() => {
    dispatch(getOrganizations());
    startTimeRef.current = Date.now();
  }, [dispatch]);

  useEffect(() => {
    if (status === "succeeded" || status === "failed") {
      const start = startTimeRef.current ?? Date.now();
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, LOADER_MIN_MS - elapsed);
      const t = setTimeout(() => setLoading(false), remaining);
      return () => clearTimeout(t);
    }
    if (status === "loading") setLoading(true);
  }, [status]);

  // const tableData = [
  //   {
  //     id: "1",
  //     organizationName: "Test Organization",
  //     orgStatus: "Active",
  //   },
  //   {
  //     id: "2",
  //     organizationName: "Test Organization 2",
  //     orgStatus: "Inactive",
  //   },
  // ];

  const filteredItems = (data ?? []).filter(
    (item) =>
      item.organizationName &&
      item.organizationName.toLowerCase().includes(filterText.toLowerCase()),
  );

  const handleClear = () => {
    if (filterText) {
      setResetPaginationToggle(!resetPaginationToggle);
      setFilterText("");
    }
  };

  const editOrg = (id) => {
    setIsEdit(true);
    setSelectedOrgId(id);
  };

  const FilterComponent = ({ filterText, onFilter, onClear }) => (
    <>
      <div className="filterOption">
        <label htmlFor="">Search</label>{" "}
        <input
          className="filterInput"
          name=""
          type="text"
          id="search"
          placeholder="Filter By Organization"
          aria-label="Search Input"
          value={filterText}
          onChange={onFilter}
          // autoFocus
        />
        {/* <span className="searchCondition">Search by Organization Name</span> */}
      </div>
    </>
  );

  //   const subHeaderComponentMemo = React.useMemo(() => {
  //     const handleClear = () => {
  //       if (filterText) {
  //         setResetPaginationToggle(!resetPaginationToggle);
  //         setFilterText("");
  //       }
  //     };
  //     return (
  //       <FilterComponent
  //         onFilter={(e) => setFilterText(e.target.value)}
  //         onClear={handleClear}
  //         filterText={filterText}
  //       />
  //     );
  //   }, [filterText, resetPaginationToggle]);

  const customStyles = {
    table: {
      style: {
        width: "100%",
        backgroundColor: "#f8f8f8",
        border: "1px solid lightgray",
      },
    },
    // headCells: {
    //   style: {
    //     justifyContent: "left",
    //     textAlign: "left",
    //   },
    // },
    // cells: {
    //   style: {
    //     justifyContent: "center",
    //     textAlign: "center",
    //   },
    // },
  };

  const columns = [
    {
      name: (
        <div
          className="tableHeader"
          style={{ textAlign: "center", width: "100%" }}
        >
          SL.No
        </div>
      ),
      selector: (row, index) => index + 1,
      sortable: true,
      width: "200px",
      minWidth: "200px",
      center: true,
    },

    {
      name: <div className="tableHeader">Organization Name</div>,
      cell: (row) => (
        <div
          style={{
            width: "100%",
            textAlign: "left",
          }}
        >
          <p
            className="orgNameClickable"
            onClick={() => openPreview?.(row)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openPreview?.(row)}
          >
            {row.organizationName}
          </p>
        </div>
      ),
      sortable: true,
    },

    {
      name: <div className="tableHeader">Status</div>,
      selector: (row) => (
        <p
          style={{ textTransform: "capitalize" }}
          className={
            row.organizationStatus === "active"
              ? "activeStatus"
              : "inactiveStatus"
          }
        >
          {row.organizationStatus}
        </p>
      ),
      sortable: true,
    },
    {
      name: <div className="tableHeader">Actions</div>,
      center: true,
      cell: (row) => (
        <div className="user_table_actions">
          <button
            type="button"
            className="user_table_action_btn"
            onClick={() => openPreview?.(row)}
            title="View organization details"
          >
            <Eye size={16} />
            View
          </button>
          {!viewOnly && (
            <button
              type="button"
              className="user_table_action_btn"
              onClick={() => editOrg(row.id)}
              title="Edit organization"
            >
              <SquarePen size={16} />
              Edit
            </button>
          )}
        </div>
      ),
      ignoreRowClick: true,
      minWidth: "160px",
      width: "160px",
    },
  ];
  const selectedOrg = data?.find((org) => org.id === selectedOrgId);

  return (
    <>
      <div className="orgDataTable">
        <div className="filterOption">
          <label htmlFor="org-search">Search</label>
          <input
            className="filterInput"
            type="text"
            id="org-search"
            placeholder="Filter by organization name"
            aria-label="Search organizations"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        {loading ? (
          <LoadingMessage message="Loading organizations…" />
        ) : (
          <DataTable
            customStyles={customStyles}
            columns={columns}
            data={filteredItems}
            pagination
            paginationResetDefaultPage={resetPaginationToggle}
            selectableRows
            persistTableHead
          />
        )}
      </div>
      {isEdit && selectedOrg && (
        <EditOrganization
          id={selectedOrgId}
          orgData={selectedOrg}
          allOrganizations={data ?? []}
          setIsEdit={setIsEdit}
        />
      )}
    </>
  );
};

export default OrganizationDataTable;

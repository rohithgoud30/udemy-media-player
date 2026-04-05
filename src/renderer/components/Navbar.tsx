import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faDownload,
  faGear,
} from "@fortawesome/free-solid-svg-icons";

const Navbar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="nav-drag-region" />

      <div className="nav-brand">
        <Link to="/">
          <span className="brand-icon">▶</span>
          <span className="brand-text">Udemy Player</span>
        </Link>
      </div>

      <div className="nav-segmented-control">
        <Link
          to="/"
          className={`segment ${location.pathname === "/" ? "active" : ""}`}
        >
          <FontAwesomeIcon icon={faBookOpen} className="segment-icon" />
          <span>Library</span>
        </Link>

        <Link
          to="/import"
          className={`segment ${location.pathname === "/import" ? "active" : ""}`}
        >
          <FontAwesomeIcon icon={faDownload} className="segment-icon" />
          <span>Import</span>
        </Link>
      </div>

      <div className="nav-actions">
        <Link
          to="/settings"
          className={`nav-icon-btn ${location.pathname === "/settings" ? "active" : ""}`}
          title="Settings"
        >
          <FontAwesomeIcon icon={faGear} />
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;

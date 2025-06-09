import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog } from "@fortawesome/free-solid-svg-icons";

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/">
          <span className="brand-text">Udemy</span>
          <span className="brand-subtitle">Media Player</span>
        </Link>
      </div>

      <div className="nav-links">
        <Link to="/" className={location.pathname === "/" ? "active" : ""}>
          <span>Library</span>
        </Link>

        <Link
          to="/import"
          className={location.pathname === "/import" ? "active" : ""}
        >
          <span>Import Course</span>
        </Link>

        <Link
          to="/settings"
          className={location.pathname === "/settings" ? "active" : ""}
          title="Settings"
        >
          <FontAwesomeIcon icon={faCog} />
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;

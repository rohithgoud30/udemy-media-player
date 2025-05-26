import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const Navbar = () => {
  const location = useLocation()

  return (
    <nav className='navbar'>
      <div className='nav-brand'>
        <Link to='/'>
          <span className='brand-text'>Udemy</span>
          <span className='brand-subtitle'>Media Player</span>
        </Link>
      </div>

      <div className='nav-links'>
        <Link to='/' className={location.pathname === '/' ? 'active' : ''}>
          Library
        </Link>

        <Link
          to='/import'
          className={location.pathname === '/import' ? 'active' : ''}
        >
          Import Course
        </Link>

        <Link
          to='/settings'
          className={location.pathname === '/settings' ? 'active' : ''}
        >
          Settings
        </Link>

        <Link
          to='/test'
          className={location.pathname === '/test' ? 'active' : ''}
        >
          Test Electron API
        </Link>
      </div>
    </nav>
  )
}

export default Navbar

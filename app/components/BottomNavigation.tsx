// app/components/BottomNavigation.tsx

'use client';


import React from 'react';
import { useState } from 'react';
import {
  BottomNavigation as MuiBottomNavigation, BottomNavigationAction,
        Drawer,
        List,
        ListItem,
        ListItemIcon,
        ListItemText,
        IconButton,
        Typography,
        Box,
} from '@mui/material';
import {
        Menu as MenuIcon,
        Home as HomeIcon,
        Favorite as FavoriteIcon,
        LocationOn as LocationOnIcon,
        Settings as SettingsIcon,
        Person as PersonIcon,
        ExitToApp as ExitToAppIcon,
        ShoppingCart as ShoppingCartIcon,
        Info as InfoIcon,
        AccessTimeFilled as AccessTimeFilledIcon,
        Newspaper as NewspaperIcon,
        LibraryBooks as BookIcon,
} from '@mui/icons-material';

import { toggleDrawer } from '../../lib/features/drawer/drawerSlice';
import { useDispatch } from 'react-redux';
  
const BottomNavigation = () => {
  const dispatch = useDispatch();

  const handleDrawerToggle = () => {
    dispatch(toggleDrawer());
  };


// const BottomNavigation = () => {
//   const [value, setValue] = useState(0);
//   const [isOpen, setIsOpen] = useState(false);

  // const toggleDrawer = () => {
  //   setIsOpen(!isOpen);
  // }
  return (
    <div>
      <div>
        <IconButton
          edge="end"
          color="inherit"
          aria-label="menu"
          sx={{ position: 'absolute', top: 0, right: 20, fontSize: '2.5rem' }}
          onClick={handleDrawerToggle}
        >
          <MenuIcon fontSize="inherit" />
        </IconButton>
      </div>

      <MuiBottomNavigation>
        {/* BottomNavigation content */}
      </MuiBottomNavigation>
    </div>
  );
};

export default BottomNavigation;
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import Image from 'next/image';

interface EUBannerControlProps {
  onPositionChange: (x: number, y: number) => void;
}

const EUBannerControl: React.FC<EUBannerControlProps> = ({ onPositionChange }) => {
  const [position, setPosition] = useState({ x: 10, y: 10 });

  const handleDragEnd = (event: React.DragEvent<HTMLImageElement>) => {
    const newX = event.clientX;
    const newY = event.clientY;
    setPosition({ x: newX, y: newY });
    onPositionChange(newX, newY);
  };

  return (
    <Box sx={{ position: 'absolute', top: position.y, left: position.x }}>
      <Image
        src="/path/to/your/image.png"
        alt="EU Banner"
        width={100}  // Specify the width
        height={50}  // Specify the height
      />
    </Box>
  );
};

export default EUBannerControl;
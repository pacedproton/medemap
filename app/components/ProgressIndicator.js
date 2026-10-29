import LinearProgress from '@mui/material/LinearProgress';
import * as React from 'react';
import '../styles/ProgressIndicator.css';

const ProgressIndicator = () => {
  const [progress, setProgress] = React.useState(0);
  const [buffer, setBuffer] = React.useState(10);

  const progressRef = React.useRef(() => {});
  React.useEffect(() => {
    progressRef.current = () => {
      if (progress > 100) {
        setProgress(0);
        setBuffer(10);
      } else {
        const diff = Math.random() * 10;
        const diff2 = Math.random() * 10;
        setProgress(progress + diff);
        setBuffer(progress + diff + diff2);
      }
    };
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      progressRef.current();
    }, 50);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className='progressIndicator'>
      <LinearProgress className="progress-indicator" variant='buffer' value={progress} valueBuffer={buffer} style={{ width: '300px', top: '10px' }} />
    </div>
  );
};

export default ProgressIndicator;

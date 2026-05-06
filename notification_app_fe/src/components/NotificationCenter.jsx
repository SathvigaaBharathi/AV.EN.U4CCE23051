import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  List, 
  ListItem, 
  ListItemText, 
  Chip, 
  Typography, 
  Paper,
  CircularProgress
} from '@mui/material';
import { Log } from '../utils/logger';

// Priority sorting logic from Stage 6
function sortPriorityInbox(notifs) {
  // skip if bad data
  if (!notifs || !Array.isArray(notifs)) return [];

  const unread = notifs.filter(n => n.isRead === false);

  unread.sort((a, b) => {
    let weightA = 0;
    if (a.type === 'Placement') weightA = 3;
    else if (a.type === 'Result') weightA = 2;
    else if (a.type === 'Event') weightA = 1;

    let weightB = 0;
    if (b.type === 'Placement') weightB = 3;
    else if (b.type === 'Result') weightB = 2;
    else if (b.type === 'Event') weightB = 1;

    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // timestamps if equal weight
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });

  return unread.slice(0, 10);
}

export default function NotificationCenter() {
  const [tabValue, setTabValue] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // fetching with basic params
      const res = await fetch('http://20.207.122.201/evaluation-service/notifications?limit=50&page=1&notification_type=all');
      
      if (!res.ok) {
        throw new Error('Failed to fetch data from server');
      }

      const data = await res.json();
      setNotifications(data.notifications || []);
      
    } catch (error) {
      // Must use Log function as requested
      Log("frontend", "error", "ui", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Get what to show based on the tab
  const getDisplayNotifs = () => {
    if (tabValue === 0) {
      // standard view - just show all
      return notifications;
    } else {
      // priority inbox view
      return sortPriorityInbox(notifications);
    }
  };

  const displayList = getDisplayNotifs();

  return (
    <Box sx={{ width: '100%', maxWidth: 800, margin: '0 auto', p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Notification Center
      </Typography>

      <Paper elevation={3} sx={{ mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          centered
          variant="fullWidth"
        >
          <Tab label="All Notifications" />
          <Tab label="Priority Inbox" />
        </Tabs>
      </Paper>

      <Paper elevation={1} sx={{ minHeight: '300px', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
            <CircularProgress />
          </Box>
        ) : displayList.length > 0 ? (
          <List>
            {displayList.map((notif, index) => (
              <ListItem 
                key={notif.id || index}
                sx={{ 
                  borderBottom: '1px solid #eee',
                  bgcolor: notif.isRead ? 'transparent' : '#f8fbff' 
                }}
              >
                <ListItemText 
                  primary={notif.message || 'No message'} 
                  secondary={new Date(notif.timestamp).toLocaleString()} 
                />
                <Chip 
                  label={notif.type || 'General'} 
                  color={
                    notif.type === 'Placement' ? 'error' : 
                    notif.type === 'Result' ? 'warning' : 'primary'
                  }
                  size="small"
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body1" sx={{ textAlign: 'center', mt: 5, color: 'text.secondary' }}>
            No notifications to show.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

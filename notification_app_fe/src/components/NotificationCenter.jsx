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
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Log } from '../utils/logger';

// Priority sorting logic from Stage 6
function sortPriorityInbox(notifs) {
  if (!notifs || !Array.isArray(notifs)) return [];

  const unread = notifs.filter(n => n.isRead === false);

  unread.sort((a, b) => {
    let weightA = a.type === 'Placement' ? 3 : a.type === 'Result' ? 2 : a.type === 'Event' ? 1 : 0;
    let weightB = b.type === 'Placement' ? 3 : b.type === 'Result' ? 2 : b.type === 'Event' ? 1 : 0;

    if (weightA !== weightB) {
      return weightB - weightA;
    }
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });

  return unread;
}

export default function NotificationCenter() {
  const [tabValue, setTabValue] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [limit, setLimit] = useState(10);
  const [typeFilter, setTypeFilter] = useState('all');

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const url = `/api/evaluation-service/notifications?limit=${limit}&page=1&notification_type=${typeFilter}`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhdi5lbi51NGNjZTIzMDUxQGF2LnN0dWRlbnRzLmFtcml0YS5lZHUiLCJleHAiOjE3NzgwNjAyNzUsImlhdCI6MTc3ODA1OTM3NSwiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6IjdiYzg4MzY0LTQwOTYtNDBjZS05NGYzLTk2OGNiZDRhOGY3MSIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6InNhdGh2aWdhYSBiIiwic3ViIjoiZmY4YWM0OGMtMGYzMy00NWI4LThhN2ItMDBiMDkyYWFiNTM1In0sImVtYWlsIjoiYXYuZW4udTRjY2UyMzA1MUBhdi5zdHVkZW50cy5hbXJpdGEuZWR1IiwibmFtZSI6InNhdGh2aWdhYSBiIiwicm9sbE5vIjoiYXYuZW4udTRjY2UyMzA1MSIsImFjY2Vzc0NvZGUiOiJQVEJNbVEiLCJjbGllbnRJRCI6ImZmOGFjNDhjLTBmMzMtNDViOC04YTdiLTAwYjA5MmFhYjUzNSIsImNsaWVudFNlY3JldCI6InZDd3RrQmJuQ0pDaEFOQUYifQ.9-f9SF8LRr1WX92UdqMLUGMDz37oNvKGAXaP-GmHwtg'
        }
      });
      
      if (!res.ok) throw new Error('Failed to fetch data');

      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      Log("frontend", "error", "ui", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [limit, typeFilter]);

  const getDisplayNotifs = () => {
    if (tabValue === 0) {
      return notifications;
    } else {
      const sorted = sortPriorityInbox(notifications);
      // only show top 'n' limit on priority tab, even if backend returned more
      return sorted.slice(0, limit);
    }
  };

  const displayList = getDisplayNotifs();

  return (
    <Box sx={{ width: '100%', maxWidth: 800, margin: '0 auto', p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Notification Center
      </Typography>

      <Paper elevation={3} sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} centered variant="fullWidth">
          <Tab label="All Notifications" />
          <Tab label="Priority Inbox" />
        </Tabs>
      </Paper>

      {tabValue === 1 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Show Top 'N'</InputLabel>
            <Select
              value={limit}
              label="Show Top 'N'"
              onChange={(e) => setLimit(e.target.value)}
            >
              <MenuItem value={10}>Top 10</MenuItem>
              <MenuItem value={15}>Top 15</MenuItem>
              <MenuItem value={20}>Top 20</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type Filter</InputLabel>
            <Select
              value={typeFilter}
              label="Type Filter"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="Event">Events</MenuItem>
              <MenuItem value="Result">Results</MenuItem>
              <MenuItem value="Placement">Placements</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

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
                  // Distinguish unread notifications clearly
                  bgcolor: notif.isRead ? 'transparent' : '#e3f2fd' 
                }}
              >
                <ListItemText 
                  primary={
                    <Typography variant="body1" fontWeight={notif.isRead ? 'normal' : 'bold'}>
                      {notif.message || 'No message'}
                    </Typography>
                  }
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

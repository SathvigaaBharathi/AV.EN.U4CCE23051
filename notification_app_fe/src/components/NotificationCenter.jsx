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
  MenuItem,
  Button
} from '@mui/material';
import { Log } from '../utils/logger';

// Priority sorting logic from Stage 6
function sortPriorityInbox(notifs) {
  if (!notifs || !Array.isArray(notifs)) return [];

  // Filter out read notifications using localStorage
  const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]');
  const unread = notifs.filter(n => !readIds.includes(n.ID));

  unread.sort((a, b) => {
    let weightA = a.Type === 'Placement' ? 3 : a.Type === 'Result' ? 2 : a.Type === 'Event' ? 1 : 0;
    let weightB = b.Type === 'Placement' ? 3 : b.Type === 'Result' ? 2 : b.Type === 'Event' ? 1 : 0;

    if (weightA !== weightB) {
      return weightB - weightA;
    }
    const tA = new Date(a.Timestamp).getTime();
    const tB = new Date(b.Timestamp).getTime();
    return tB - tA;
  });

  return unread;
}

export default function NotificationCenter() {
  const [tabValue, setTabValue] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState(JSON.parse(localStorage.getItem('readNotifications') || '[]'));
  
  // Filters
  const [limit, setLimit] = useState(10);
  const [typeFilter, setTypeFilter] = useState('all');

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const markAsRead = (id) => {
    const newReadIds = [...readIds, id];
    setReadIds(newReadIds);
    localStorage.setItem('readNotifications', JSON.stringify(newReadIds));
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Build query params - only add notification_type if not 'all'
      const params = new URLSearchParams({
        limit: limit.toString(),
        page: '1'
      });
      
      if (typeFilter !== 'all') {
        params.append('notification_type', typeFilter);
      }
      
      const url = `/api/evaluation-service/notifications?${params.toString()}`;
      
      console.log('Fetching from:', url);
      
      const res = await fetch(url, {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhdi5lbi51NGNjZTIzMDUxQGF2LnN0dWRlbnRzLmFtcml0YS5lZHUiLCJleHAiOjE3NzgwNjI2NjgsImlhdCI6MTc3ODA2MTc2OCwiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6IjI2MWVmNDY5LWIxNTUtNGQ5MS1hOTgzLTVlMzdiOGUwZThkMSIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6InNhdGh2aWdhYSBiIiwic3ViIjoiZmY4YWM0OGMtMGYzMy00NWI4LThhN2ItMDBiMDkyYWFiNTM1In0sImVtYWlsIjoiYXYuZW4udTRjY2UyMzA1MUBhdi5zdHVkZW50cy5hbXJpdGEuZWR1IiwibmFtZSI6InNhdGh2aWdhYSBiIiwicm9sbE5vIjoiYXYuZW4udTRjY2UyMzA1MSIsImFjY2Vzc0NvZGUiOiJQVEJNbVEiLCJjbGllbnRJRCI6ImZmOGFjNDhjLTBmMzMtNDViOC04YTdiLTAwYjA5MmFhYjUzNSIsImNsaWVudFNlY3JldCI6InZDd3RrQmJuQ0pDaEFOQUYifQ.Zb5jgxPrRMth2ASD6zNH4uGWYbIrE5sczsTXZoSoohM'
        }
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
         const errText = await res.text();
         console.error("API Error Response:", errText);
         console.error("Status:", res.status, res.statusText);
         throw new Error(`API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      console.log('Received data:', data);
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Fetch error:", error);
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
      let sorted = sortPriorityInbox(notifications);
      // apply type filter client-side for priority inbox
      if (typeFilter !== 'all') {
        sorted = sorted.filter(n => n.Type === typeFilter);
      }
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
            {displayList.map((notif, index) => {
              const isRead = readIds.includes(notif.ID);
              return (
                <ListItem 
                  key={notif.ID || index}
                  sx={{ 
                    borderBottom: '1px solid #eee',
                    bgcolor: isRead ? 'transparent' : '#e3f2fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    pr: 1
                  }}
                >
                  <ListItemText 
                    primary={
                      <Typography variant="body1" fontWeight={isRead ? 'normal' : 'bold'}>
                        {notif.Message || 'No message'}
                      </Typography>
                    }
                    secondary={new Date(notif.Timestamp).toLocaleString()} 
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <Chip 
                      label={notif.Type || 'General'} 
                      color={
                        notif.Type === 'Placement' ? 'error' : 
                        notif.Type === 'Result' ? 'warning' : 'primary'
                      }
                      size="small"
                    />
                    {!isRead && (
                      <Button size="small" variant="outlined" onClick={() => markAsRead(notif.ID)}>
                        Mark Read
                      </Button>
                    )}
                  </Box>
                </ListItem>
              )
            })}
          </List>
        ) : (
          <Typography variant="body1" sx={{ textAlign: 'center', mt: 5, color: 'text.secondary' }}>
            No notifications to show. (If testing, check if token is valid)
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

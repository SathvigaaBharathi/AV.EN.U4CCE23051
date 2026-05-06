// priorityInbox.js

function getPriorityInbox(notifications) {
    if (!notifications || !Array.isArray(notifications)) {
        return [];
    }

    // first, filter out the ones that are already read
    const unreadNotifications = notifications.filter(notification => notification.isRead === false);

    // sort them based on weight and then by recency if weight is the same
    unreadNotifications.sort((a, b) => {
        const weightA = getNotificationWeight(a.Type || a.type);
        const weightB = getNotificationWeight(b.Type || b.type);

        if (weightA !== weightB) {
            // higher weight comes first
            return weightB - weightA;
        }

        // if weights are equal, newer timestamp comes first
        const timeA = new Date(a.Timestamp || a.timestamp).getTime();
        const timeB = new Date(b.Timestamp || b.timestamp).getTime();
        
        return timeB - timeA;
    });

    // just return the top 10
    return unreadNotifications.slice(0, 10);
}

function getNotificationWeight(notificationType) {
    // assign priority weights based on type
    if (notificationType === 'Placement') {
        return 3;
    } else if (notificationType === 'Result') {
        return 2;
    } else if (notificationType === 'Event') {
        return 1;
    }
    
    // default for everything else
    return 0;
}

export { getPriorityInbox };

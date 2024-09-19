const { app } = require('@azure/functions');


const fetch = require('node-fetch').default;

// Azure AD tenant ID and app ID for the service principal
const clientId = "d308f3c0-4043-4f80-b63f-736feead9fd0"; // This is the App Registration Client ID (Service Principal)
const tenantId = "a4b2de60-9bd7-43fa-8c11-911b09749203";
const clientShh = "M8l8Q~yZN5wUTiBmxKgn_p5eLqL6Up-~6wnpqcVM"; // Store this securely
const servicePrincipalId = "2ef3b8c6-a332-4bbc-a2de-6ab1473c87f5"; // This is the App Registration Object ID (Service Principal)
const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;



app.http('appRolesReact', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        let user;

        if (request.method === 'POST') {
            // Parse the request body if it's a POST request
            user = await request.json();
        } else if (request.method === 'GET') {
            // Parse query parameters if it's a GET request
            user = {
                userId: request.query.get('userId') || null
            };
        }

        // Get user ID from the request payload
        const userId = user.userId || null; // Use 'userId' from the request

        if (!userId) {
            context.log('User ID is missing in the request payload');
            return { status: 400, body: { error: 'User ID is missing' } };
        }




        const accessToken = await getAccessToken();



        // Get the available app roles from the service principal dynamically
        const appRoles = await getAppRolesFromServicePrincipal(accessToken, userId);

        if (!appRoles) {
            context.log('Failed to retrieve app roles');
            return { status: 500, body: { error: 'Failed to retrieve app roles' } };
        }

        // Check user's app role assignments against the dynamic mappings
        const userRoles = await getUserAppRoles(userId, accessToken);
        if (!userRoles) {
            context.log('Failed to retrieve user roles');
            return { status: 500, body: { error: 'Failed to retrieve user roles' } };
        }

        // Extract appRoleIds from user's assignments
        const userAppRoleIds = userRoles.value.map(assignment => assignment.appRoleId);

        // Match the appRoleId from user assignments with the id in appRoles and get the value
        const matchedRoles = appRoles.appRoles
            .filter(role => userAppRoleIds.includes(role.id)) // Match ids
            .map(role => role.value); // Only return the values

        // Final result
        const result = { roles: matchedRoles };

        context.log(`Result: ${JSON.stringify(result)}`);



        return { body: JSON.stringify(result) };
        //return { body: 'Hello World' };
    }
});



async function getAccessToken() {
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            scope: 'https://graph.microsoft.com/.default', // This requests all granted permissions
            client_secret: clientShh,
            grant_type: 'client_credentials'
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(`Error acquiring access token: ${data.error_description}`);
    }
    return data.access_token;
}

// Function to get app roles from the service principal
async function getAppRolesFromServicePrincipal(bearerToken) {
    console.log('Bearer token: ', bearerToken);

    const url = `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}?$select=appRoles`
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${bearerToken}`
        },
    });

    if (response.status !== 200) {
        console.log(`Error fetching service principal: ${response.status}`);
        return null;
    }

    const appRoles = await response.json();

    return appRoles;
}

// Function to get user's app role assignments
async function getUserAppRoles(userId, bearerToken) {
    const url = `https://graph.microsoft.com/v1.0/users/${userId}/appRoleAssignments`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${bearerToken}` // Ensure your access token is valid
        },
    });

    if (response.status !== 200) {
        console.log(`Error fetching app role assignments: ${response.status}`);
        return null;
    }

    const userRoles = await response.json();

    return userRoles;
}


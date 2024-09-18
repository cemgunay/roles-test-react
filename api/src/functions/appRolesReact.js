const { app } = require('@azure/functions');
const fetch = require('node-fetch').default;

// Azure AD tenant ID and app ID for the service principal
const clientId = "d308f3c0-4043-4f80-b63f-736feead9fd0"; // This is the App Registration Client ID (Service Principal)

app.http('appRolesReact', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const roles = [];

        // Parse the request body (Postman sends raw JSON data)
        const user = await request.json();

        context.log(`User details: ${JSON.stringify(user.userDetails)}`);

        // Get user ID from the access token
        const userId = await getUserIdFromToken(user.accessToken);

        if (!userId) {
            context.log('Invalid token or unable to extract user ID');
            return { status: 400, body: { error: 'Invalid token or unable to extract user ID' } };
        }

        context.log(`User ID: ${userId}`);

        // Get the available app roles from the service principal dynamically
        const appRoleMappings = await getAppRolesFromServicePrincipal(user.accessToken);
        if (!appRoleMappings) {
            context.log('Failed to retrieve app roles');
            return { status: 500, body: { error: 'Failed to retrieve app roles' } };
        }

        context.log(`App roles: ${JSON.stringify(appRoleMappings)}`);

        // Check user's app role assignments against the dynamic mappings
        for (const [roleName, appRoleId] of Object.entries(appRoleMappings)) {
            if (await isUserInAppRole(userId, appRoleId, user.accessToken)) {
                roles.push(roleName);
            }
        }

        context.log(`User roles: ${JSON.stringify(roles)}`);

        return { body: JSON.stringify({ roles }),
    };
    }
});

// Function to get user ID from the access token
async function getUserIdFromToken(bearerToken) {
    console.log(`Bearer token: ${bearerToken}`);
    const url = 'https://graph.microsoft.com/v1.0/me';
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${bearerToken}`
        }
    });

    console.log(`Response status: ${response.status}`);

    if (response.status !== 200) {
        return null;
    }

    const graphResponse = await response.json();
    return graphResponse.id;
}

async function getAppRolesFromServicePrincipal(bearerToken) {
    const url = `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${clientId}'`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${bearerToken}`
        },
    });

    console.log(`Response status: ${response.status}`);

    if (response.status !== 200) {
        return null;
    }

    const graphResponse = await response.json();
    const servicePrincipal = graphResponse.value[0];

    // Map the app roles to an object { roleName: appRoleId }
    const appRoleMappings = {};
    servicePrincipal.appRoles.forEach(appRole => {
        if (appRole.value) {
            appRoleMappings[appRole.value] = appRole.id;
        }
    });

    return appRoleMappings;
}

// Function to check if the user is assigned a specific app role
async function isUserInAppRole(userId, appRoleId, bearerToken) {
    const url = `https://graph.microsoft.com/v1.0/users/${userId}/appRoleAssignments`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${bearerToken}`
        },
    });

    console.log(`Response status: ${response.status}`);

    if (response.status !== 200) {
        return false;
    }

    const graphResponse = await response.json();
    const matchingRoles = graphResponse.value.filter(role => role.appRoleId === appRoleId);
    return matchingRoles.length > 0;
}

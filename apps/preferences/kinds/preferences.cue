package preferences

preferencesV1alpha1: {
	kind:       "Preferences"
	pluralName: "Preferences"
	scope:      "Namespaced"

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		spec: {
			// UID for the home dashboard
			homeDashboardUID?: string

			// The timezone selection
			// TODO: this should use the timezone defined in common
			timezone?: string

			// day of the week (sunday, monday, etc)
			weekStart?: string

			// light, dark, empty is default
			theme?: string

			// Selected language (beta)
			language?: string

			// Selected locale (beta)
			regionalFormat?: string

			// Explore query history preferences
			queryHistory?: #QueryHistoryPreference

			// Cookie preferences
			cookiePreferences?: #CookiePreferences

			// BMC Change - Format for dashboards, panels and reports timestamps
			timeFormat?: string

			// BMC Change - Toggle to set available query types for the tenant
			enabledQueryTypes?: #EnabledQueryTypes
			
			// Navigation preferences
			navbar?: #NavbarPreference

			// BMC change - Toggle for loading empty panels - DRJ71-14546
			loadEmptyPanels?: boolean

			// BMC change - Toggle for using default variable values from dashboard JSON
			useDefaultVariableValues?: boolean

		} @cuetsy(kind="interface")

		#QueryHistoryPreference: {
			// one of: '' | 'query' | 'starred';
			homeTab?: string
		}

		#CookiePreferences: {
			analytics?: {}
			performance?: {}
			functional?: {}
		}

		#EnabledQueryTypes: {
			enabledTypes?: [...string]
			applyForAdmin?: bool
		} @cuetsy(kind="interface") //0.0
		
		#NavbarPreference: {
			bookmarkUrls: [...string]
		} 
	}
}

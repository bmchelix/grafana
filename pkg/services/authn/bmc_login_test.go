package authn

import "testing"

func TestIsBmcPplLogin(t *testing.T) {
	tests := []struct {
		login  string
		prefix string
		want   bool
	}{
		{"bmc_ppl_Demo", "bmc_ppl_", true},
		{"bmc_ppl_Demo@tenant", "bmc_ppl_", true},
		{"BMC_PPL_Demo", "bmc_ppl_", true},
		{"bmc_ppl_Demo", "BMC_PPL_", true},
		{"  bmc_ppl_Demo@tenant  ", " bmc_ppl_ ", true},
		{"other_user", "bmc_ppl_", false},
		{"bmc_ppl_Demo", "", true},
		{"custom_ppl_Demo", "custom_ppl_", true},
		{"custom_ppl_Demo@tenant", "custom_ppl_", true},
	}
	for _, tt := range tests {
		if got := IsBmcPplLogin(tt.login, tt.prefix); got != tt.want {
			t.Errorf("IsBmcPplLogin(%q, %q) = %v, want %v", tt.login, tt.prefix, got, tt.want)
		}
	}
}

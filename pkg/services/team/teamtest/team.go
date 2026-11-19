package teamtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/team"
)

type FakeService struct {
	ExpectedTeam        team.Team
	ExpectedIsMember    bool
	ExpectedIsAdmin     bool
	ExpectedTeamDTO     *team.TeamDTO
	ExpectedTeamsByUser []*team.TeamDTO
	ExpectedMembers     []*team.TeamMemberDTO
	ExpectedError       error
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

func NewFakeServiceWithTeamDTO(teamDTO *team.TeamDTO) *FakeService {
	return &FakeService{
		ExpectedTeamDTO: teamDTO,
	}
}

func (s *FakeService) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	_ = ctx
	_ = cmd
	return s.ExpectedTeam, s.ExpectedError
}

func (s *FakeService) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	return s.ExpectedError
}

func (s *FakeService) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	return s.ExpectedError
}

func (s *FakeService) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	return team.SearchTeamQueryResult{}, s.ExpectedError
}

func (s *FakeService) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	return s.ExpectedTeamDTO, s.ExpectedError
}

func (s *FakeService) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	return s.ExpectedTeamsByUser, s.ExpectedError
}

func (s *FakeService) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	return s.ExpectedIsMember, s.ExpectedError
}

func (s *FakeService) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	return s.ExpectedError
}

func (s *FakeService) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	return s.ExpectedMembers, s.ExpectedError
}

func (s *FakeService) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	return s.ExpectedMembers, s.ExpectedError
}

func (s *FakeService) RegisterDelete(query string) {
}

func (s *FakeService) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error) {
	_ = ctx
	_ = query
	result := make([]int64, 0)
	for _, tm := range s.ExpectedTeamsByUser {
		result = append(result, tm.ID)
	}

	return result, s.ExpectedError
}

func (s *FakeService) GetTeamsByIds(ctx context.Context, orgID int64, teamIDs []int64) ([]*team.TeamDTO, error) {
	_ = ctx
	_ = orgID
	if s.ExpectedError != nil {
		return nil, s.ExpectedError
	}
	if len(teamIDs) == 0 || len(s.ExpectedTeamsByUser) == 0 {
		return nil, nil
	}
	idSet := make(map[int64]struct{}, len(teamIDs))
	for _, id := range teamIDs {
		idSet[id] = struct{}{}
	}
	var out []*team.TeamDTO
	for _, tm := range s.ExpectedTeamsByUser {
		if _, ok := idSet[tm.ID]; ok {
			out = append(out, tm)
		}
	}
	return out, nil
}

/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by kmejdi at 29/7/2021
 */

import { FC, PureComponent } from 'react';

import { t } from '@grafana/i18n';
import { Field, Icon, Input } from '@grafana/ui';

type onChangeValue = (value: any) => void;

interface Props {
  onDocLinkChange: onChangeValue;
  onCommunityLinkChange: onChangeValue;
  onSupportLinkChange: onChangeValue;
  onVideoLinkChange: onChangeValue;
  docLink: string;
  supportLink: string;
  communityLink: string;
  videoLink: string;
}

interface State {}

// eslint-disable-next-line react-prefer-function-component/react-prefer-function-component
export class OrgCustomConfiguration extends PureComponent<Props, State> {
  state: State = {};

  constructor(props: Props) {
    super(props);
  }

  async componentDidMount() {
    this.setState({
      docLink: this.props.docLink,
      supportLink: this.props.supportLink,
      communityLink: this.props.communityLink,
      videoLink: this.props.videoLink,
    });
  }

  render() {
    const { docLink, supportLink, communityLink, videoLink } = this.props;
    return (
      <>
        <Field noMargin label={t('bmc.org-custom-config.documentation', 'Documentation')}>
          <Input type="text" value={docLink} suffix={<DocSuffix />} onChange={this.props.onDocLinkChange} />
        </Field>
        <Field noMargin label={t('bmc.org-custom-config.support', 'Support')}>
          <Input type="text" value={supportLink} onChange={this.props.onSupportLinkChange} suffix={<SupportSuffix />} />
        </Field>
        <Field noMargin label={t('bmc.org-custom-config.community', 'Community')}>
          <Input
            type="text"
            value={communityLink}
            onChange={this.props.onCommunityLinkChange}
            suffix={<CommunitySuffix />}
          />
        </Field>
        <Field noMargin label={t('bmc.org-custom-config.video', 'Video')}>
          <Input type="text" value={videoLink} onChange={this.props.onVideoLinkChange} suffix={<VideoSuffix />} />
        </Field>
      </>
    );
  }
}

const DocSuffix: FC = () => {
  return <Icon name="document-info" />;
};

const SupportSuffix: FC = () => {
  return <Icon name="question-circle" />;
};

const CommunitySuffix: FC = () => {
  return <Icon name="comments-alt" />;
};

const VideoSuffix: FC = () => {
  return <Icon name="link" />;
};
